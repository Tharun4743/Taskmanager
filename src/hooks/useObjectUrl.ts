import { useEffect, useState } from 'react';

/**
 * Creates a memoized blob object URL for a File/Blob and automatically revokes
 * it when the file changes or the owning component unmounts.
 */
export function useObjectUrl(file: Blob | File | null | undefined): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return objectUrl;
}
