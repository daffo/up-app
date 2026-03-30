import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import { getLocalImageUri } from '../lib/cache/image-file-cache';

/**
 * Shared image component with local filesystem caching.
 * Downloads remote images once to disk, serves locally afterwards.
 * Use this for all image rendering instead of bare expo-image or react-native Image.
 */
export default function CachedImage({ source, ...props }: ImageProps) {
  const remoteUri =
    source && typeof source === 'object' && 'uri' in source ? source.uri : null;

  const [localUri, setLocalUri] = useState<string | null>(null);

  useEffect(() => {
    if (!remoteUri) {
      setLocalUri(null);
      return;
    }

    let cancelled = false;
    getLocalImageUri(remoteUri).then((uri) => {
      if (!cancelled) setLocalUri(uri);
    }).catch(() => {
      // Fallback: use remote URL directly if download fails
      if (!cancelled) setLocalUri(remoteUri);
    });

    return () => { cancelled = true; };
  }, [remoteUri]);

  // Non-URI source (require(), etc.) — pass through directly
  if (!remoteUri) {
    return <Image cachePolicy="memory-disk" source={source} {...props} />;
  }

  // While resolving, show placeholder to prevent layout shift
  if (!localUri) {
    return <View style={[props.style, styles.placeholder]} />;
  }

  return (
    <Image
      cachePolicy="memory-disk"
      source={{ ...((source && typeof source === 'object') ? source : {}), uri: localUri }}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: 'transparent',
  },
});
