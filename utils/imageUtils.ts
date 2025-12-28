export const resizeImageForAI = async (base64Str: string, maxSide: number = 1536): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

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

                ctx.drawImage(img, 0, 0, width, height);
                // Convert to JPEG with 85% quality
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            } else {
                reject(new Error("Could not get canvas context"));
            }
        };
        img.onerror = reject;
        img.src = base64Str;
    });
};
