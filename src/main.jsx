import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Note: StrictMode is removed to prevent double-firing auth in development
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
