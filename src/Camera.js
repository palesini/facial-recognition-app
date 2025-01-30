import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';

const Camera = () => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [metrics, setMetrics] = useState({
    faceCount: 0,
    averageAge: 0,
    predominantGender: '',
    emotions: {}
  });

  // 1. Cargar modelos
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
        await faceapi.nets.ageGenderNet.loadFromUri('/models');
      } catch (error) {
        console.error("Error loading models:", error);
      }
    };
    loadModels();
  }, []);

  // 2. Configurar cámara y canvas
  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          videoRef.current.onloadedmetadata = () => {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video && canvas) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
          };
        }
      } catch (error) {
        console.error("Error al acceder a la cámara:", error);
      }
    };

    setupCamera();

    // Limpieza al desmontar el componente
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 3. Detección facial
  const detectFaces = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const detections = await faceapi
      .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender();

    // Escalar detecciones al tamaño del canvas
    const resizedDetections = faceapi.resizeResults(detections, {
      width: videoRef.current.videoWidth,
      height: videoRef.current.videoHeight
    });

    // Actualizar métricas
    const faceCount = detections.length;
    const totalAge = detections.reduce((sum, d) => sum + d.age, 0);
    const averageAge = faceCount > 0 ? (totalAge / faceCount).toFixed(1) : 0;
    const predominantGender = faceCount > 0 ? 
      detections.reduce((acc, d) => (acc[d.gender] = (acc[d.gender] || 0) + 1, acc), {}) : '';
    
    setMetrics({
      faceCount,
      averageAge,
      predominantGender: Object.keys(predominantGender).reduce((a, b) => predominantGender[a] > predominantGender[b] ? a : b, ''),
      emotions: faceCount > 0 ? detections[0].expressions : {}
    });

    // Dibujar resultados
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
    faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
    faceapi.draw.drawFaceExpressions(canvasRef.current, resizedDetections);
    
    requestAnimationFrame(detectFaces);
  };

  // 4. Iniciar detección
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => requestAnimationFrame(detectFaces);
    video.addEventListener('play', handlePlay);

    return () => {
      if (video) {
        video.removeEventListener('play', handlePlay);
      }
    };
  }, []);

  return (
    <div className="camera-container">
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline 
        className="video-element"
      />
      <canvas ref={canvasRef} className="overlay-canvas" />
      
      <div className="metrics-panel">
        <h3>Real-time statistics</h3>
        <p>👥 Faces detected: {metrics.faceCount}</p>
        <p>📊 Average age: {metrics.averageAge}</p>
        <p>👫 Predominant gender: {metrics.predominantGender}</p>
        <div className="emotions-grid">
          {Object.entries(metrics.emotions).map(([emotion, value]) => (
            <div key={emotion} className="emotion-item">
              <span className="emotion-label">{emotion}:</span>
              <span className="emotion-value">{(value * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Camera;
};

export default Camera;
