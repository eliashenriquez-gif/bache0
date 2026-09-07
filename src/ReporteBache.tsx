import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ReporteBacheScreen() {
  const [descripcion, setDescripcion] = useState('');
  const [gravedad, setGravedad] = useState('Media');
  const [imagen, setImagen] = useState<string | null>(null);
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [cargandoUbi, setCargandoUbi] = useState(false);

  const obtenerUbicacion = async () => {
    setCargandoUbi(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la ubicación.');
      setCargandoUbi(false);
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    setUbicacion({
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    });
    setCargandoUbi(false);
  };

  const tomarFoto = async () => {
    let permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara.');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setImagen(result.assets[0].uri);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.titulo}>Reporte de Bache (Integrante 1)</Text>

      <Text style={styles.label}>Evidencia Fotográfica:</Text>
      {imagen && <Image source={{ uri: imagen }} style={styles.preview} />}
      <TouchableOpacity style={styles.btnSecundario} onPress={tomarFoto}>
        <Text style={styles.btnTexto}>📷 Tomar Foto del Bache</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Ubicación GPS:</Text>
      {ubicacion ? (
        <Text style={styles.coords}>
          Lat: {ubicacion.lat.toFixed(5)} | Lng: {ubicacion.lng.toFixed(5)}
        </Text>
      ) : (
        <Text style={styles.coords}>Ubicación no capturada</Text>
      )}
      <TouchableOpacity style={styles.btnSecundario} onPress={obtenerUbicacion}>
        <Text style={styles.btnTexto}>
          {cargandoUbi ? 'Obteniendo GPS...' : '📍 Capturar Mi Ubicación'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Gravedad del Bache:</Text>
      <View style={styles.opcionesContenedor}>
        {['Baja', 'Media', 'Alta'].map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.btnOpcion, gravedad === item && styles.btnOpcionActiva]}
            onPress={() => setGravedad(item)}
          >
            <Text style={gravedad === item ? styles.txtActivo : styles.txtInactivo}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Descripción del Problema:</Text>
      <TextInput
        style={styles.input}
        multiline
        numberOfLines={3}
        placeholder="Ej: Bache profundo en el carril derecho..."
        value={descripcion}
        onChangeText={setDescripcion}
      />

      <TouchableOpacity 
        style={styles.btnGuardar} 
        onPress={() => Alert.alert('Éxito', 'Reporte guardado correctamente')}
      >
        <Text style={styles.btnGuardarTexto}>Guardar Reporte</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, marginTop: 30, color: '#333' },
  label: { fontSize: 16, fontWeight: '600', marginTop: 15, marginBottom: 5, color: '#444' },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ccc' },
  preview: { width: '100%', height: 200, borderRadius: 8, marginBottom: 10 },
  coords: { fontSize: 14, color: '#666', marginBottom: 5, fontStyle: 'italic' },
  btnSecundario: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  btnTexto: { color: '#fff', fontWeight: 'bold' },
  opcionesContenedor: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  btnOpcion: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', marginHorizontal: 2, borderRadius: 6 },
  btnOpcionActiva: { backgroundColor: '#34C759', borderColor: '#34C759' },
  txtActivo: { color: '#fff', fontWeight: 'bold' },
  txtInactivo: { color: '#333' },
  btnGuardar: { backgroundColor: '#28a745', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  btnGuardarTexto: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
