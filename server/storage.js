import { v2 as cloudinary } from 'cloudinary'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const configured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
if (configured) cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET })

export const storageMode = configured ? 'cloudinary' : 'local'

export async function saveFile(file, folder = 'auditflow') {
  if (configured) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'auto', use_filename: true, unique_filename: true }, (error, data) => error ? reject(error) : resolve(data))
      stream.end(file.buffer)
    })
    return { provider: 'cloudinary', url: result.secure_url, publicId: result.public_id, name: file.originalname, size: file.size }
  }
  const dir = path.resolve('storage/uploads')
  await fs.mkdir(dir, { recursive: true })
  const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`
  await fs.writeFile(path.join(dir, filename), file.buffer)
  return { provider: 'local', url: `/uploads/${filename}`, publicId: filename, name: file.originalname, size: file.size }
}
