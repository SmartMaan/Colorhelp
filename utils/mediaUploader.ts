export const uploadFile = (file: File, apiKey: string, onProgress: (progress: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('image', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.imgbb.com/1/upload?key=${apiKey}`, true);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                onProgress(percentComplete);
            }
        };

        xhr.onload = () => {
            onProgress(100); // Ensure it reaches 100%
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    if (result.success && result.data && result.data.url) {
                        resolve(result.data.url);
                    } else {
                        reject(new Error(result.error?.message || 'Failed to get image URL from response.'));
                    }
                } catch (e) {
                     reject(new Error('Failed to parse server response.'));
                }
            } else {
                reject(new Error(`Upload failed with status: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error('A network error occurred during the upload.'));
        };
        
        xhr.onabort = () => {
            reject(new Error('Upload was canceled.'));
        };

        xhr.send(formData);
    });
};
