export const resizeImageForAI = async (base64Str: string, maxSide: number = 1536): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // 'inside' fit logic: Resize only if larger than maxSide, maintaining aspect ratio
            if (width > maxSide || height > maxSide) {
                if (width > height) {
                    height = Math.round((height * maxSide) / width);
                    width = maxSide;
                } else {
                    width = Math.round((width * maxSide) / height);
                    height = maxSide;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // White background to avoid PNG transparency issues if converted to JPEG
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);

                // Use high quality image smoothing (optional, but good for downscaling)
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.drawImage(img, 0, 0, width, height);
                // Convert to JPEG with 90% quality (Sweet Spot)
                resolve(canvas.toDataURL('image/jpeg', 0.90));
            } else {
                reject(new Error("Could not get canvas context"));
            }
        };
        img.onerror = reject;
        img.src = base64Str;
    });
};

export const downloadFile = async (url: string, filename: string) => {
    // If it's a data URL or blob URL, we can use the simple anchor tag method
    if (url.startsWith('data:') || url.startsWith('blob:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    // For remote URLs (like Firebase Storage), we fetch as blob to bypass CORS download restrictions
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Cleanup
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
        console.error("Error downloading file:", error);
        // Fallback: try direct download as a last resort (might fail for cross-origin)
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = "_blank"; // At least don't take over the current tab
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
