import { Image, ImageProps } from 'expo-image';

/**
 * Shared image component with aggressive disk + memory caching.
 * Use this for all image rendering instead of bare expo-image or react-native Image.
 */
export default function CachedImage(props: ImageProps) {
  return <Image cachePolicy="memory-disk" {...props} />;
}
