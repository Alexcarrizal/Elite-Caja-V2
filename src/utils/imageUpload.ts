import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';

export const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height *= maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width *= maxHeight / height));
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas is empty'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const compressImageToBase64 = (file: File, maxWidth = 350, maxHeight = 350, quality = 0.5): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const uploadImageToFirebase = async (file: File, path: string): Promise<string> => {
  let base64Fallback = '';
  try {
    base64Fallback = await compressImageToBase64(file);
  } catch (err) {
    console.error('Failed to pre-compress to base64', err);
  }

  try {
    const compressedBlob = await compressImage(file);
    const storageRef = ref(storage, path);
    
    // 3-second timeout to avoid infinite spinning wheel if Firebase Storage is inactive/blocked
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('El almacenamiento en la nube demoró demasiado')), 3000)
    );

    const uploadPromise = (async () => {
      await uploadBytes(storageRef, compressedBlob);
      return await getDownloadURL(storageRef);
    })();

    const url = await Promise.race([uploadPromise, timeoutPromise]);
    return url;
  } catch (error) {
    console.warn('Firebase Storage upload failed or timed out. Falling back to clean local base64 storage:', error);
    if (base64Fallback) {
      return base64Fallback;
    }
    throw error;
  }
};

