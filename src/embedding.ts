import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

// Use quantized model for faster inference and smaller footprint (~22MB).
// The model is downloaded and cached on first use (~/.cache/huggingface).
const MODEL = "Xenova/all-MiniLM-L6-v2";

let _pipe: FeatureExtractionPipeline | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!_pipe) {
    _pipe = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
  }
  return _pipe;
}

export async function embed(text: string): Promise<Float32Array> {
  const pipe = await getPipeline();
  // pooling=mean collapses token embeddings into one vector; normalize=true gives unit vectors
  // suitable for cosine similarity. The tokenizer truncates to 512 tokens automatically.
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return output.data as Float32Array;
}
