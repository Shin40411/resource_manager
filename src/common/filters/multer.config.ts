import { diskStorage } from 'multer';
import { extname } from 'path';

export const multerConfig = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      let uploadPath = 'uploads/';
      if (file.mimetype.startsWith('image')) uploadPath += 'images';
      else if (file.mimetype.startsWith('video')) uploadPath += 'videos';
      else uploadPath += 'files';

      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 300 * 1024 * 1024 }, // Giới hạn 300MB
};