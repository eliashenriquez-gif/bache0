import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

export default function ReporteBacheScreen() {
  // Estados para los datos recopilados
  const [fotoUri, setFotoUri] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [gravedad, setGravedad] = useState('Media');
  const [descripcion, setDescripcion] = useState('');

  // Estados de carga e interfaz
  const [loadingGps, setLoadingGps] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Obtener GPS automáticamente al cargar la pantalla
  useEffect(() => {
    obtenerUbicacionGPS();
  }, []);

  // 1. Obtener coordenadas GPS exactas
  const obtenerUbicacionGPS = async () => {
    setLoadingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso denegado',
          'Se requieren permisos de ubicación para georreferenciar el bache.'
        );
        setLoadingGps(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUbicacion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener la ubicación GPS.');
      console.error(error);
    } finally {
      setLoadingGps(false);
    }
  };

  // 2. Tomar foto con la cámara
  const tomarFoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso denegado',
          'Se necesitan permisos de acceso a la cámara para capturar la imagen.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFotoUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Ocurrió un problema al abrir la cámara.');
      console.error(error);
    }
  };

  // 3. Simular el envío del reporte (Frontend Pure)
  const handleSubmit = () => {
    if (!fotoUri) {
      Alert.alert('Foto requerida', 'Debes tomar una foto del bache para continuar.');
      return;
    }

    if (!ubicacion) {
      Alert.alert('GPS requerido', 'Es necesario contar con la ubicación GPS.');
      return;
    }

    setEnviando(true);

    // Formato de datos para el Mock API
    const nuevoReporte = {
      id: `reporte-${Date.now()}`,
      fotoUri,
      coordenadas: ubicacion,
      gravedad,
      descripcion,
      fechaEnvio: new Date().toISOString(),
      estado: 'Pendiente',
    };

    // Simulación de envío (1.5 segundos)
    setTimeout(() => {
      console.log('--- REPORTE ENVIADO CON ÉXITO ---');
      console.log(JSON.stringify(nuevoReporte, null, 2));

      setEnviando(false);

      Alert.alert(
        '¡Reporte Registrado!',
        `El bache ha sido registrado correctamente.\nLat: ${ubicacion.latitude.toFixed(5)}\nLong: ${ubicacion.longitude.toFixed(5)}`,
        [
          {
            text: 'Aceptar',
            onPress: () => {
              setFotoUri(null);
              setDescripcion('');
              setGravedad('Media');
            },
          },
        ]
      );
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        <Text style={styles.titulo}>Reporte de Bache en Terreno</Text>
        <Text style={styles.subtitulo}>
          Captura la evidencia visual y ubicación del daño vial.
        </Text>

        {/* 1. FOTO DEL BACHE */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>1. Fotografía de Evidencia</Text>
          
          {fotoUri ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: fotoUri }} style={styles.previewImage} />
              <TouchableOpacity style={styles.retryButton} onPress={tomarFoto}>
                <Ionicons name="camera-reverse" size={20} color="#fff" />
                <Text style={styles.retryText}>Repetir Foto</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.cameraPlaceholder} onPress={tomarFoto}>
              <Ionicons name="camera-outline" size={48} color="#0066CC" />
              <Text style={styles.cameraText}>Tocar para tomar fotografía</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 2. UBICACIÓN GPS */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardHeader}>2. Coordenadas GPS</Text>
            <TouchableOpacity onPress={obtenerUbicacionGPS} disabled={loadingGps}>
              <Ionicons name="refresh" size={20} color="#0066CC" />
            </TouchableOpacity>
          </View>

          {loadingGps ? (
            <View style={styles.gpsContainer}>
              <ActivityIndicator color="#0066CC" size="small" />
              <Text style={styles.gpsText}>Obteniendo señal satelital...</Text>
            </View>
          ) : ubicacion ? (
            <View style={styles.gpsContainer}>
              <Ionicons name="location" size={22} color="#2e7d32" />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.gpsData}>Latitud: {ubicacion.latitude.toFixed(6)}</Text>
                <Text style={styles.gpsData}>Longitud: {ubicacion.longitude.toFixed(6)}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.errorText}>No se pudo obtener la ubicación GPS.</Text>
          )}
        </View>

        {/* 3. FORMULARIO DE DETALLES */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>3. Detalles del Incidente</Text>

          <Text style={styles.label}>Nivel de Gravedad / Deterioro:</Text>
          <View style={styles.badgeGroup}>
            {['Baja', 'Media', 'Alta'].map((nivel) => {
              const isSelected = gravedad === nivel;
              return (
                <TouchableOpacity
                  key={nivel}
                  style={[
                    styles.badge,
                    isSelected && styles[`badgeActive_${nivel}`],
                  ]}
                  onPress={() => setGravedad(nivel)}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      isSelected && styles.badgeTextActive,
                    ]}
                  >
                    {nivel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Descripción Adicional:</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            placeholder="Escribe detalles del bache (ej: carril derecho, peligro para ciclistas, etc.)"
            placeholderTextColor="#888"
            value={descripcion}
            onChangeText={setDescripcion}
          />
        </View>

        {/* BOTÓN DE ENVÍO */}
        <TouchableOpacity
          style={[styles.submitButton, enviando && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={enviando}
        >
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitText}>Enviar Reporte</Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  subtitulo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cameraPlaceholder: {
    height: 160,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0066CC',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
  },
  cameraText: {
    marginTop: 8,
    color: '#0066CC',
    fontWeight: '600',
  },
  imageContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  retryButton: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  retryText: {
    color: '#FFF',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '600',
  },
  gpsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  gpsText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  gpsData: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 4,
  },
  badgeGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  badge: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#EFEFEF',
    marginHorizontal: 4,
  },
  badgeActive_Baja: {
    backgroundColor: '#4CAF50',
  },
  badgeActive_Media: {
    backgroundColor: '#FF9800',
  },
  badgeActive_Alta: {
    backgroundColor: '#F44336',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  badgeTextActive: {
    color: '#FFF',
  },
  textArea: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#333',
    minHeight: 80,
  },
  submitButton: {
    backgroundColor: '#0066CC',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#99C2EC',
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
