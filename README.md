# Bache 0

> Para las municipalidades que necesitan mayor visibilidad sobre el deterioro vial de su comuna, Bache 0 entrega una plataforma web que centraliza reportes ciudadanos georreferenciados y los transforma en información visual para facilitar la priorización de reparaciones viales.

## 👥 Equipo de Trabajo

- **Elías Henríquez** — GitHub: [@eliashenriquez-gif](https://github.com/eliashenriquez-gif)
- **Bastian Mansilla** — GitHub: [@bastianmansilla](https://github.com/bastianmansilla)
- **David Ojeda** — GitHub: [@davidojeda-alt](https://github.com/davidojeda-alt)

## 🔗 Prototipo Navegable
- **Módulo municipal:** [https://bache0.vercel.app/](https://bache0.vercel.app/) 
- **Módulo ciudadano:** [https://bache0.vercel.app/reporte](https://bache0.vercel.app/reporte)


El prototipo corresponde a una misma aplicación web con dos módulos según el contexto de uso.

## 📄 Documentación

- [Documento de propuesta](./docs/Documento_de_propuesta_comercial.pdf)
- [Presentación](./docs/presentacion.pdf)
- [Mapa del producto](./docs/Mapa%20de%20producto%20Bache%200.png)
- [Diagrama de arquitectura](./docs/diagrama_arquitectura%20bache%200.png)

## ⚙️ Requisitos Previos

Antes de ejecutar el proyecto, se debe contar con:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/)
- [Visual Studio Code](https://code.visualstudio.com/)
- Un navegador web actualizado.

> **Nota:** npm se instala junto con Node.js, por lo que no es necesario instalarlo por separado.

## 🚀 Instalación y Ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/eliashenriquez-gif/bache0.git
```

### 2. Entrar a la carpeta del proyecto

```bash
cd bache0
```

### 3. Instalar las dependencias

```bash
npm install
```

### 4. Ejecutar el proyecto

```bash
npm run dev
```

Vite mostrará en la terminal la dirección local donde se encuentra disponible la aplicación.

## 💻 Tecnologías

- React
- Vite
- JavaScript
- HTML
- CSS

## 📌 Estado del proyecto

Este repositorio corresponde al Hito 1 del proyecto semestral.

La versión actual se concentra principalmente en el Front-End y en la validación de la experiencia de usuario. El panel municipal utiliza datos simulados para representar escenarios de uso.

El backend, la persistencia de datos y el componente de visión artificial corresponden a etapas posteriores de desarrollo.

## 📁 Estructura del repositorio

```text
bache0/
├── docs/
│   ├── Documento_de_propuesta_comercial.pdf
│   ├── presentacion.pdf
│   ├── Mapa de producto Bache 0.png
│   └── diagrama_arquitectura bache 0.png
├── src/
├── public/
├── package.json
├── package-lock.json
├── README.md
└── .gitignore
```