export interface ModelStatus {
  model_loaded: boolean;
  model_architecture: string;
  device: string;
  num_classes: number;
  classes: Record<string, string>;
  weights_path: string;
  weights_exist: boolean;
}

export interface ExplainResponse {
  predicted_class_id: number;
  predicted_class_name: string;
  confidence: number;
  probabilities: Record<string, number>;
  target_layer: string;
  heatmap_base64: string;
  overlay_base64: string;
  device: string;
  filename: string;
}
