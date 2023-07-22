const pot = (v: number) => Math.pow(2, Math.floor(Math.log2(v)));


export class ImageLoader {
    cache: {[url: string]: ImageData} = {};

    constructor(public cacheSize = 100) {
    }

    getImageData(url: string) {
        return new Promise<ImageData>((resolve, reject) => {
            const cached = this.cache[url];
            if (cached) {
                resolve(cached);
                return;
            }
            const img = document.createElement('img');
            img.onload = () => {
                let width = pot(img.naturalWidth);
                let height = pot(img.naturalHeight);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                // maintain cache
                const keys = Object.keys(this.cache);
                if (keys.length === this.cacheSize) {
                    delete this.cache[keys[0]];
                }
                this.cache[url] = imageData;
                resolve(imageData);
            };

            img.onerror = (e) => {
                reject(e);
            }

            img.src = url;
    
    
        });
    }

}