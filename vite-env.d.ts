/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

// WebGPU types (minimal declarations for navigator.gpu)
interface GPU {
  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
}

interface GPURequestAdapterOptions {
  powerPreference?: 'low-power' | 'high-performance';
}

interface GPUAdapter {
  readonly name: string;
  requestDevice(descriptor?: Record<string, unknown>): Promise<GPUDevice>;
}

interface GPUDevice {
  readonly label: string;
}

interface Navigator {
  readonly gpu?: GPU;
}
