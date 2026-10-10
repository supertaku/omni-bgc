import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';

export function useOfflineFonts() {
  return useFonts({
    OmniHeading: require('../../assets/fonts/Nunito-Bold.ttf'),
    OmniBody: require('../../assets/fonts/NunitoSans-Regular.ttf'),
    OmniBodySemiBold: require('../../assets/fonts/NunitoSans-SemiBold.ttf'),
    ...Ionicons.font,
  });
}
