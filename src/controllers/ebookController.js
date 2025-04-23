const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createEbook = async ({ title, description, autor, price, fileUrl, imageEbook }) => {
    try {
        const ebook = await prisma.ebook.create({
            data: {
                title,
                description,
                autor,
                price,
                fileUrl,
                imageEbook
            }
        });

        return {
            status: 201,
            data: ebook
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: error.message }
        };
    }
}

const getAllEbooks = async () => {
    try {
        const ebooks = await prisma.ebook.findMany();

        return {
            status: 200,
            data: ebooks
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: error.message }
        };
    }
}

getEbookById = async ({ id }) => {
    try {
        const ebook = await prisma.ebook.findUnique({
            where: {
                id: parseInt(id)
            }
        });

        if (!ebook) {
            return {
                status: 404,
                data: { message: 'Ebook não encontrado.' }
            };
        }

        return {
            status: 200,
            data: ebook
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: error.message }
        };
    }
}

const updateEbook = async ({ id, title, description, autor, price, fileUrl, imageEbook }) => {
    try {
        const ebook = await prisma.ebook.update({
            where: {
                id: parseInt(id)
            },
            data: {
                title,
                description,
                autor,
                price,
                fileUrl,
                imageEbook
            }
        });

        return {
            status: 200,
            data: ebook
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: error.message }
        };
    }
}

const deleteEbook = async ({ id }) => {
    try {
        await prisma.ebook.delete({
            where: {
                id: parseInt(id)
            }
        });

        return {
            status: 204,
            data: {}
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: error.message }
        };
    }
}

module.exports = {
    createEbook,
    getAllEbooks,
    getEbookById,
    updateEbook,
    deleteEbook
}