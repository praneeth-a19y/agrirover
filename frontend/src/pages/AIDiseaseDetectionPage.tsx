import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Camera,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Layers,
  HelpCircle,
  FileSearch,
  Radio,
  Wifi,
  RefreshCw,
  ExternalLink,
  Bot
} from 'lucide-react';
import { api } from '../services/api';
import { socketService } from '../services/socketService';
import { DiseasePrediction, DiseaseScanHistoryItem, Plot } from '../types';

interface AIDiseaseDetectionPageProps {
  isDemoMode: boolean;
  onRefreshScans?: () => void;
}

export const AIDiseaseDetectionPage: React.FC<AIDiseaseDetectionPageProps> = ({ isDemoMode }) => {
  const [activeTab, setActiveTab] = useState<'esp32' | 'manual'>('esp32');
  
  // Manual upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropType, setCropType] = useState<string>('Tomato');
  const [plotId, setPlotId] = useState<string>('plot-001');
  const [rowId, setRowId] = useState<string>('Row A1');
  const [plots, setPlots] = useState<Plot[]>([]);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState<DiseasePrediction | null>(null);
  const [recentScans, setRecentScans] = useState<DiseaseScanHistoryItem[]>([]);
  const [modelStatus, setModelStatus] = useState<any>(null);

  // ESP32-CAM Live Rover Ingestion State
  const [latestRoverCapture, setLatestRoverCapture] = useState<{
    has_image: boolean;
    image_url: string | null;
    scan_id: string | null;
    prediction: DiseasePrediction | null;
    timestamp: string | null;
    source: string;
  }>({
    has_image: false,
    image_url: null,
    scan_id: null,
    prediction: null,
    timestamp: null,
    source: 'standby'
  });
  const [autoPollRover, setAutoPollRover] = useState<boolean>(true);
  const [esp32Ip, setEsp32Ip] = useState<string>('192.168.1.150');
  const [isFetchingDirect, setIsFetchingDirect] = useState<boolean>(false);
  
  // Camera capture modal/video
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isTriggeringMqtt, setIsTriggeringMqtt] = useState<boolean>(false);

  useEffect(() => {
    loadPlots();
    loadRecentScans();
    loadModelStatus();
    loadLatestRoverCapture();

    // Real-Time Socket.IO Subscriptions for instant image & disease detection updates
    const unsubCap = socketService.onCameraCapture((cap) => {
      if (cap && cap.has_image) {
        setLatestRoverCapture(cap);
        if (cap.prediction) {
          setPrediction(cap.prediction);
        }
        loadRecentScans();
      }
    });

    const unsubScan = socketService.onDiseaseScan((pred) => {
      if (pred) {
        setPrediction(pred);
        loadRecentScans();
      }
    });

    return () => {
      unsubCap();
      unsubScan();
    };
  }, []);

  const handleTriggerMqttCapture = async () => {
    setIsTriggeringMqtt(true);
    try {
      await api.sendRoverCommand('CAPTURE', 1000);
      // Brief feedback
    } catch (err: any) {
      alert('MQTT Camera dispatch error: ' + err.message);
    } finally {
      setTimeout(() => setIsTriggeringMqtt(false), 2000);
    }
  };

  // Poll for incoming images sent by ESP32-CAM
  useEffect(() => {
    let timer: any = null;
    if (autoPollRover) {
      timer = setInterval(() => {
        loadLatestRoverCapture();
      }, 3000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [autoPollRover]);

  const loadPlots = async () => {
    try {
      const data = await api.getPlots();
      setPlots(data);
    } catch (err) {
      console.error('Error fetching plots:', err);
    }
  };

  const loadRecentScans = async () => {
    try {
      const data = await api.getDiseaseScans(undefined, undefined, 6);
      setRecentScans(data);
    } catch (err) {
      console.error('Error fetching recent scans:', err);
    }
  };

  const loadModelStatus = async () => {
    try {
      const data = await api.getModelStatus();
      setModelStatus(data);
    } catch (err) {
      console.error('Error fetching model status:', err);
    }
  };

  const loadLatestRoverCapture = async () => {
    try {
      const capture = await api.getLatestCapture();
      if (capture && capture.has_image) {
        setLatestRoverCapture(capture);
        if (!prediction && capture.prediction) {
          setPrediction(capture.prediction);
        }
      }
    } catch (err) {
      // silent poll fail
    }
  };

  const handleCaptureFromEsp32Direct = async () => {
    if (!esp32Ip) return;
    setIsFetchingDirect(true);
    try {
      // ESP32-CAM typically hosts /capture returning image/jpeg
      const url = `http://${esp32Ip.replace('http://', '').replace('/', '')}/capture`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`ESP32 returned status ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], `esp32_rover_${Date.now()}.jpg`, { type: 'image/jpeg' });
      handleFileSelect(file);
      setActiveTab('manual');
      // Automatically run analysis
      const formData = new FormData();
      formData.append('file', file);
      formData.append('crop_hint', cropType);
      formData.append('plot_id', plotId);
      formData.append('row_id', rowId);
      formData.append('is_demo', isDemoMode.toString());
      setIsAnalyzing(true);
      const result = await api.predictCropDisease(formData);
      setPrediction(result);
      loadRecentScans();
    } catch (err) {
      alert(`Could not fetch direct frame from ESP32 at ${esp32Ip}. Make sure your computer is on the same Wi-Fi network as the rover, or upload an image directly. Error: ${(err as Error).message}`);
    } finally {
      setIsFetchingDirect(false);
      setIsAnalyzing(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPrediction(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Webcam capture
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('Unable to access camera: ' + (err as Error).message);
      setIsCameraActive(false);
    }
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `cam_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          handleFileSelect(file);
        }
      }, 'image/jpeg');
    }
    stopCamera();
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsCameraActive(false);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('crop_hint', cropType);
      formData.append('plot_id', plotId);
      formData.append('row_id', rowId);
      formData.append('is_demo', isDemoMode.toString());

      const result = await api.predictCropDisease(formData);
      setPrediction(result);
      loadRecentScans();
    } catch (err) {
      alert('Analysis error: ' + (err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const displayPrediction = prediction || latestRoverCapture.prediction;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl bg-agri-darkest border border-agri-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-agri-offwhite flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-agri-lime" />
            <span>AI Crop Disease Diagnosis (PlantVillage 38-Class Architecture)</span>
          </h2>
          <p className="text-xs text-agri-muted">
            ESP32-CAM mobile rover image receiver & deep learning foliar pathology verifier.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-agri-card border border-agri-border text-xs font-medium">
            <button
              onClick={() => setActiveTab('esp32')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'esp32'
                  ? 'bg-agri-lime text-agri-darkest font-bold shadow-sm'
                  : 'text-agri-muted hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Rover ESP32-CAM Live</span>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'manual'
                  ? 'bg-agri-lime text-agri-darkest font-bold shadow-sm'
                  : 'text-agri-muted hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Manual Upload & Cam</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 Cols): Acquisition / Stream */}
        <div className="lg:col-span-7 space-y-5">
          {activeTab === 'esp32' ? (
            /* TAB 1: ESP32-CAM Live Rover Ingestion */
            <div className="agri-card p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-agri-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <h3 className="text-sm font-bold text-agri-offwhite">
                    Rover ESP32-CAM Ingestion Receiver
                  </h3>
                </div>
                
                {/* Auto poll switch */}
                <button
                  onClick={() => setAutoPollRover(!autoPollRover)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all ${
                    autoPollRover
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-agri-darkest text-agri-muted border-agri-border'
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${autoPollRover ? 'animate-spin' : ''}`} />
                  <span>{autoPollRover ? 'Live Sync Active' : 'Paused'}</span>
                </button>
              </div>

              {/* Trigger Rover Camera via EMQX MQTT Broker */}
              <div className="p-3 rounded-xl bg-agri-darkest/90 border border-agri-lime/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-agri-lime animate-pulse" />
                  <div>
                    <span className="text-agri-offwhite font-bold block">Cloud MQTT Camera Trigger</span>
                    <span className="text-[10px] text-agri-muted">Dispatches command to rover/camera/capture</span>
                  </div>
                </div>
                <button
                  onClick={handleTriggerMqttCapture}
                  disabled={isTriggeringMqtt}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-agri-lime hover:bg-agri-lime/90 text-agri-darkest font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-lime-500/10 active:scale-95 disabled:opacity-50"
                >
                  {isTriggeringMqtt ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  <span>{isTriggeringMqtt ? 'Sending MQTT...' : '📸 Snap Photo via MQTT'}</span>
                </button>
              </div>

              {/* Direct Rover Wi-Fi IP Connect */}
              <div className="p-3 rounded-xl bg-agri-darkest/70 border border-agri-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Wifi className="w-4 h-4 text-agri-lime flex-shrink-0" />
                  <span className="text-agri-muted whitespace-nowrap">ESP32-CAM IP:</span>
                  <input
                    type="text"
                    value={esp32Ip}
                    onChange={(e) => setEsp32Ip(e.target.value)}
                    placeholder="192.168.1.150"
                    className="w-full sm:w-36 px-2.5 py-1 rounded-lg bg-agri-card border border-agri-border text-agri-offwhite font-mono outline-none focus:border-agri-lime"
                  />
                </div>
                <button
                  onClick={handleCaptureFromEsp32Direct}
                  disabled={isFetchingDirect || isAnalyzing}
                  className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-agri-card hover:bg-agri-cardHover border border-agri-lime/40 text-agri-lime font-semibold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isFetchingDirect ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  <span>Capture from Rover Now</span>
                </button>
              </div>

              {/* Live Image Box */}
              {latestRoverCapture.has_image && latestRoverCapture.image_url ? (
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-agri-border group">
                  <img
                    src={latestRoverCapture.image_url}
                    alt="Latest Rover Frame"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-sm border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>RECEIVED FROM ROVER</span>
                  </div>
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-sm text-xs font-mono text-agri-muted">
                    Time: {latestRoverCapture.timestamp ? new Date(latestRoverCapture.timestamp).toLocaleTimeString() : 'Just now'}
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-agri-border/80 rounded-2xl p-8 text-center bg-agri-darkest/40 flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-agri-card border border-agri-border flex items-center justify-center text-agri-lime shadow-md">
                    <Bot className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-agri-offwhite">
                      Waiting for ESP32-CAM Image Transmission
                    </p>
                    <p className="text-xs text-agri-muted max-w-md mx-auto">
                      When the rover moves along crop rows and captures a leaf with its camera, the photo automatically streams here and is verified by the deep learning model.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => setActiveTab('manual')}
                      className="text-xs text-agri-lime hover:underline font-semibold"
                    >
                      Or upload a test leaf manually →
                    </button>
                  </div>
                </div>
              )}

              {/* API Connection Documentation Note */}
              <div className="p-3.5 rounded-xl bg-agri-card/30 border border-agri-border/50 text-[11px] text-agri-muted space-y-1">
                <span className="font-semibold text-agri-offwhite block">ESP32 Firmware Target:</span>
                <p>
                  Configure ESP32-CAM to POST multipart images to <code className="text-agri-lime font-mono">http://&lt;your-ip&gt;:8000/upload</code> or <code className="text-agri-lime font-mono">/api/v1/disease/predict</code>. The incoming frame will verify automatically in this browser window.
                </p>
              </div>
            </div>
          ) : (
            /* TAB 2: Manual Upload & Webcam */
            <div className="agri-card p-5 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-agri-offwhite flex items-center justify-between">
                <span>Manual Leaf Photograph Acquisition</span>
                <span className="text-xs font-mono text-agri-muted">File / Drag-and-Drop / Web Camera</span>
              </h3>

              {isCameraActive ? (
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-agri-border">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 inset-x-0 flex justify-center gap-4">
                    <button
                      onClick={captureFrame}
                      className="px-5 py-2.5 rounded-xl bg-agri-lime text-agri-darkest font-bold text-xs shadow-lg flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Leaf Photo</span>
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-4 py-2.5 rounded-xl bg-agri-card text-agri-offwhite font-medium text-xs border border-agri-border"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-agri-darkest border border-agri-border group">
                  <img src={previewUrl} alt="Leaf Preview" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-agri-darkest border border-agri-border text-agri-offwhite text-xs font-medium"
                    >
                      Change Image
                    </button>
                    <button
                      onClick={startCamera}
                      className="px-3.5 py-2 rounded-xl bg-agri-darkest border border-agri-border text-agri-lime text-xs font-medium"
                    >
                      Use Camera
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-agri-border/80 hover:border-agri-lime/60 rounded-2xl p-8 text-center transition-all bg-agri-darkest/40 flex flex-col items-center justify-center gap-3 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-14 h-14 rounded-2xl bg-agri-card border border-agri-border flex items-center justify-center text-agri-lime shadow-md">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-agri-offwhite">
                      Drag and drop crop leaf photograph here
                    </p>
                    <p className="text-xs text-agri-muted mt-1">
                      Supports JPG, PNG, WEBP (Max 8MB). Preprocessed to 224x224 RGB.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-agri-card hover:bg-agri-cardHover text-agri-offwhite border border-agri-border">
                      Browse Computer / Phone
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startCamera();
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-agri-card hover:bg-agri-cardHover text-agri-lime border border-agri-lime/30"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Live Camera</span>
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              {/* Crop & Plot Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div>
                  <label className="block text-agri-muted mb-1">Target Crop:</label>
                  <select
                    value={cropType}
                    onChange={(e) => setCropType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-agri-darkest border border-agri-border text-agri-offwhite outline-none focus:border-agri-lime"
                  >
                    <option value="Tomato">Tomato (Solanum lycopersicum)</option>
                    <option value="Potato">Potato (Solanum tuberosum)</option>
                    <option value="Corn (Maize)">Corn / Maize (Zea mays)</option>
                    <option value="Bell Pepper">Bell Pepper (Capsicum annuum)</option>
                    <option value="Apple">Apple (Malus domestica)</option>
                    <option value="Grape">Grape (Vitis vinifera)</option>
                    <option value="Peach">Peach (Prunus persica)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-agri-muted mb-1">Plot Location:</label>
                  <select
                    value={plotId}
                    onChange={(e) => setPlotId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-agri-darkest border border-agri-border text-agri-offwhite outline-none focus:border-agri-lime"
                  >
                    {plots.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.crop_type})
                      </option>
                    ))}
                    {plots.length === 0 && (
                      <option value="plot-001">North Tomato Field</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-agri-muted mb-1">Row Identifier:</label>
                  <input
                    type="text"
                    value={rowId}
                    onChange={(e) => setRowId(e.target.value)}
                    placeholder="e.g. Row A4"
                    className="w-full px-3 py-2 rounded-xl bg-agri-darkest border border-agri-border text-agri-offwhite outline-none focus:border-agri-lime font-mono"
                  />
                </div>
              </div>

              {/* Analyze Trigger */}
              <div className="pt-2">
                <button
                  onClick={handleAnalyze}
                  disabled={!selectedFile || isAnalyzing}
                  className="w-full py-3 rounded-xl bg-agri-lime hover:bg-agri-limeBright disabled:opacity-40 text-agri-darkest font-bold text-sm tracking-wide transition-all shadow-lg shadow-agri-lime/20 flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Executing PlantVillage Neural Inference...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Run Crop Foliage Diagnosis</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 Cols): Prediction Results & Verification Output */}
        <div className="lg:col-span-5 space-y-5">
          <div className="agri-card p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-agri-border/40 pb-3">
              <h3 className="text-sm font-bold text-agri-offwhite flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-agri-lime" />
                <span>Verification Output & Diagnosis</span>
              </h3>
              {displayPrediction && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-agri-card border border-agri-border text-agri-muted">
                  ID: {displayPrediction.scan_id || 'live-scan'}
                </span>
              )}
            </div>

            {displayPrediction ? (
              <div className="space-y-4">
                {/* Result Status Banner */}
                <div
                  className={`p-4 rounded-xl border ${
                    displayPrediction.is_healthy
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : displayPrediction.severity === 'Severe'
                      ? 'bg-red-950/60 border-red-500/40 text-red-200'
                      : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase font-mono tracking-wider font-semibold opacity-80">
                        {displayPrediction.is_healthy ? 'CROP HEALTHY' : 'PATHOGEN DETECTED'}
                      </div>
                      <h4 className="text-base font-extrabold text-white mt-0.5">
                        {displayPrediction.diseaseName || displayPrediction.predicted_class}
                      </h4>
                      <p className="text-[11px] font-mono opacity-70 mt-0.5">
                        Class: {displayPrediction.predictedClass || displayPrediction.predicted_class}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${
                        displayPrediction.is_healthy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {displayPrediction.confidencePercent !== undefined
                        ? `${displayPrediction.confidencePercent.toFixed(1)}%`
                        : `${Math.round(displayPrediction.confidence * 100)}%`}
                    </span>
                  </div>

                  {/* Confidence Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px] font-mono opacity-80">
                      <span>Model Confidence</span>
                      <span>
                        {displayPrediction.confidencePercent !== undefined
                          ? `${displayPrediction.confidencePercent}%`
                          : `${(displayPrediction.confidence * 100).toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${
                          displayPrediction.is_healthy ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                        style={{
                          width: `${
                            displayPrediction.confidencePercent !== undefined
                              ? displayPrediction.confidencePercent
                              : Math.round(displayPrediction.confidence * 100)
                          }%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Needs Review Flag */}
                  {displayPrediction.needsReview && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-mono text-amber-300 bg-amber-950/80 p-1.5 rounded-lg border border-amber-500/40">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Review recommended: Confidence is below minimum threshold.</span>
                    </div>
                  )}
                </div>

                {/* Pathogen Classification */}
                {displayPrediction.pathogen && (
                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-agri-darkest/70 border border-agri-border/60 text-xs">
                    <span className="text-agri-muted">Pathogen:</span>
                    <span className="font-semibold text-agri-offwhite">{displayPrediction.pathogen}</span>
                  </div>
                )}

                {/* Symptoms Description */}
                <div className="space-y-1 text-xs">
                  <span className="font-semibold text-agri-offwhite flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-agri-lime" />
                    <span>Pathological Symptoms:</span>
                  </span>
                  <p className="text-agri-muted leading-relaxed p-3 rounded-xl bg-agri-darkest/70 border border-agri-border/60">
                    {displayPrediction.symptoms}
                  </p>
                </div>

                {/* Agronomic Recommendations */}
                <div className="space-y-1 text-xs">
                  <span className="font-semibold text-agri-offwhite flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-agri-lime" />
                    <span>Recommended Treatment Protocol:</span>
                  </span>
                  <p className="text-agri-offwhite/90 leading-relaxed p-3 rounded-xl bg-agri-darkest/70 border border-agri-border/60 font-sans">
                    {displayPrediction.recommendations}
                  </p>
                </div>

                {/* Model Note */}
                <div className="p-2.5 rounded-xl bg-agri-card/30 border border-agri-border/40 text-[10px] text-agri-muted">
                  {displayPrediction.note || "Model trained on PlantVillage (38 classes, 54,303 images); verify predictions with field images or an agricultural expert."}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-2">
                <Sparkles className="w-8 h-8 text-agri-muted mx-auto opacity-40" />
                <p className="text-sm font-semibold text-agri-offwhite">Awaiting Foliage Frame</p>
                <p className="text-xs text-agri-muted max-w-xs mx-auto">
                  Images transmitted from the ESP32 rover will verify and render diagnosis output here in real-time.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Scans Reel */}
      <div className="agri-card p-5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-agri-border/40 pb-3">
          <h3 className="text-sm font-bold text-agri-offwhite">Recent Field Scan Reel</h3>
          <span className="text-xs text-agri-muted">Historical image observations</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {recentScans.map((scan) => (
            <div
              key={scan.id}
              className="p-2 rounded-xl bg-agri-darkest/80 border border-agri-border/60 space-y-2 text-xs"
            >
              <div className="aspect-square rounded-lg overflow-hidden bg-black border border-agri-border/40 relative">
                <img src={scan.image_url} alt={scan.predicted_class} className="w-full h-full object-cover" />
                <div className="absolute top-1 right-1">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      scan.is_healthy ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                    }`}
                  >
                    {Math.round(scan.confidence * 100)}%
                  </span>
                </div>
              </div>
              <div className="leading-tight">
                <p className="font-semibold text-[11px] text-agri-offwhite truncate" title={scan.predicted_class}>
                  {scan.predicted_class}
                </p>
                <p className="text-[10px] text-agri-muted truncate">
                  {scan.plot_id || 'Plot 1'}
                </p>
              </div>
            </div>
          ))}
          {recentScans.length === 0 && (
            <p className="text-xs text-agri-muted py-4 col-span-full text-center">
              No previous scans stored.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
