import { requireOptionalNativeModule } from 'expo-modules-core';
import type { NativeEngineBridge } from '../../src/ai/contracts';
export const nativeLocalAi = requireOptionalNativeModule<NativeEngineBridge>('OmniLocalAi');
