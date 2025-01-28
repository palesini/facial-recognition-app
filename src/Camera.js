import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';

const Camera = () => {
  // Referencias para el video y el canvas
  const videoRef = useRef();
  const canvasRef = useRef();

  // Estado para almacenar las métricas
  const [metrics, setMetrics] = useState({
    faceCount: 0,
    averageAge: 0,
    predominantGender: '',
    emotions: {},
  });

  // Cargar los modelos de Face-API.js
  useEffect(() => {
    const loadModels = async () => {
      try {
        // Cargar los modelos desde la carpeta "public/models"
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
        await faceapi.nets.ageGenderNet.loadFromUri('/models');
        console.log('Modelos cargados correctamente');
      } catch (error) {
        console.error('Error cargando los modelos:', error);
      }
    };

    loadModels();
  }, []);

  // Iniciar la cámara automáticamente
  useEffect(() => {
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('El navegador no soporta getUserMedia');
        }

        // Solicitar acceso a la cámara
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        alert(`Error al acceder a la cámara: ${error.message}`);
      }
    };

    startCamera();
  }, []);

  // Función para calcular la moda (género predominante)
  const mode = (arr) => {
    return arr.sort((a, b) =>
      arr.filter((v) => v === a).length - arr.filter((v) => v === b).length
    ).pop();
  };

  // Procesar el video en tiempo real
  const handleVideoPlay = () => {
    const interval = setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        // Detectar rostros, expresiones, edad y género
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions()
          .withAgeAndGender();

        // Calcular métricas
        const faceCount = detections.length;
        const totalAge = detections.reduce((sum, detection) => sum + detection.age, 0);
        const averageAge = faceCount > 0 ? (totalAge / faceCount).toFixed(1) : 0;
        const genders = detections.map((detection) => detection.gender);
        const predominantGender = genders.length > 0 ? mode(genders) : '';
        const emotions = detections.reduce((acc, detection) => {
          Object.entries(detection.expressions).forEach(([emotion, value]) => {
            acc[emotion] = (acc[emotion] || 0) + value;
          });
          return acc;
        }, {});

        // Actualizar el estado de las métricas
        setMetrics({
          faceCount,
          averageAge,
          predominantGender,
          emotions,
        });

        // Dibujar las detecciones en el canvas
        const context = canvasRef.current.getContext('2d');
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        faceapi.matchDimensions(canvasRef.current, {
          width: 640,
          height: 480,
        });
        const resizedDetections = faceapi.resizeResults(detections, {
          width: 640,
          height: 480,
        });
        faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvasRef.current, resizedDetections);

        // Mostrar edad y género
        resizedDetections.forEach((detection) => {
          const { age, gender, genderProbability } = detection;
          const text = `${Math.round(age)} años, ${gender} (${Math.round(genderProbability * 100)}%)`;
          const bottomRight = {
            x: detection.detection.box.bottomRight.x,
            y: detection.detection.box.bottomRight.y,
          };
          new faceapi.draw.DrawTextField([text], bottomRight).draw(canvasRef.current);
        });
      }
    }, 100); // Procesar cada 100ms

    // Limpiar el intervalo cuando el componente se desmonte
    return () => clearInterval(interval);
  };

  // Renderizar el panel de métricas
  const renderMetrics = () => (
    <div className="results-panel">
      <h3>Metrics</h3>
      <p><strong>Detected Faces:</strong> {metrics.faceCount}</p>
      <p><strong>Average Age:</strong> {metrics.averageAge} años</p>
      <p><strong>Predominant Genre:</strong> {metrics.predominantGender}</p>
      <p><strong>Emotions:</strong></p>
      <ul>
        {Object.entries(metrics.emotions).map(([emotion, value]) => (
          <li key={emotion}>
            {emotion}: {(value / metrics.faceCount).toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div>
      <h2>SoFutu FaceTrust AI</h2>
      <div className="camera-container">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onPlay={handleVideoPlay}
          width="640"
          height="480"
        />
        <canvas
          ref={canvasRef}
          width="640"
          height="480"
        />
      </div>
      {renderMetrics()}
    </div>
  );
};

export default Camera;
