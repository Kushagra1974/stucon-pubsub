import doenv from "dotenv"
doenv.config()
import { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } from "@azure/storage-blob";




export const uploadToBLob = async (file) => {
    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.BLOB_CONNECTION_STRING);
        const containerClient = blobServiceClient.getContainerClient(process.env.CONTAINER_NAME);
        const options = { blobHTTPHeaders: { blobContentType: file.mimetype } }
        const blockBlobClient = containerClient.getBlockBlobClient(file.originalname)
        await blockBlobClient.uploadData(file.buffer, options)
        const url = blockBlobClient.url
        return url;
    } catch (err) {
        console.log(err)
    }
}
