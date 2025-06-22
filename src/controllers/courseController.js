const prisma = require('../lib/prisma');
const { HTTP_STATUS_CODES, ERROR_MESSAGES, SUCCESS_MESSAGES } = require('../utils/enum');
const Stripe = require('stripe');


const createSTRIPECheckoutSession = async ({ courseId, userId }) => {
    try {
        // Converte o courseId para número e valida
        const courseIdNumber = parseInt(courseId, 10);
        if (isNaN(courseIdNumber)) {
            return {
                status: 400,
                data: { message: "ID do curso inválido" },
            };
        }

        // Busca o curso com o id convertido
        const course = await prisma.course.findUnique({
            where: { id: courseIdNumber },
        });
        if (!course) {
            return {
                status: 404,
                data: { message: "Curso não encontrado" },
            };
        }

        // Instancia o cliente Stripe com a chave secreta
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2020-08-27',
        });

        // Cria a sessão de checkout do Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: [
                'card',
                'boleto',
            ],
            line_items: [
                {
                    price_data: {
                        currency: 'brl',
                        product_data: {
                            name: course.title,
                            description: course.description,
                        },
                        unit_amount: course.price * 100,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/success?courseId=${courseId}&userId=${userId}`,
            cancel_url: `${process.env.CLIENT_URL}/cancel`,
            metadata: {
                courseId,
                userId,
            },
        });


        return {
            status: 200,
            data: { sessionId: session.id },
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: "Erro ao criar sessão de checkout" },
        };
    }
};

const addCursoStripeAoUser = async ({ userId, courseId }) => {
    try {
        // Verificar se o curso existe
        const course = await prisma.course.findUnique({ where: { id: parseInt(courseId, 10) } });
        if (!course) {
            return {
                status: 404,
                data: { message: "Curso não encontrado" },
            };
        }

        // Verificar se o usuário existe
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId, 10) },
            include: { courses: true },
        });
        if (!user) {
            return {
                status: 404,
                data: { message: "Usuário não encontrado" },
            };
        }

        // Verificar se o curso já está associado ao usuário
        const isAlreadyAdded = user.courses.some(c => c.id === course.id);
        if (isAlreadyAdded) {
            return {
                status: 400,
                data: { message: "Curso já está associado ao usuário" },
            };
        }

        // Adicionar o curso ao usuário
        await prisma.user.update({
            where: { id: parseInt(userId, 10) },
            data: {
                courses: {
                    connect: { id: parseInt(courseId, 10) },
                },
            },
        });

        return {
            status: 200,
            data: { message: "Curso adicionado ao usuário com sucesso!" },
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: "Erro ao adicionar curso ao usuário" },
        };
    }
}

const addCursoAoUser = async ({ userId, courseId }) => {
    try {
        // Verificar se o curso existe
        const course = await prisma.course.findUnique({ where: { id: parseInt(courseId, 10) } });
        if (!course) {
            return {
                status: 404,
                data: { message: "Curso não encontrado" },
            };
        }

        // Verificar se o usuário existe
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId, 10) },
            include: { courses: true },
        });
        if (!user) {
            return {
                status: 404,
                data: { message: "Usuário não encontrado" },
            };
        }

        // Verificar se o curso já está associado ao usuário
        const isAlreadyAdded = user.courses.some(c => c.id === course.id);
        if (isAlreadyAdded) {
            return {
                status: 400,
                data: { message: "Curso já está associado ao usuário" },
            };
        }

        // Adicionar o curso ao usuário
        await prisma.user.update({
            where: { id: parseInt(userId, 10) },
            data: {
                courses: {
                    connect: { id: parseInt(courseId, 10) },
                },
            },
        });

        return {
            status: 200,
            data: { message: "Curso adicionado ao usuário com sucesso!" },
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: "Erro ao adicionar curso ao usuário" },
        };
    }
};

const createCourse = async ({ title, description, price, videoUrl, coverImage }) => {
    try {
        const newCourse = await prisma.course.create({
            data: {
                title,
                description,
                price,
                videoUrl,
                coverImage, // Incluindo a imagem de capa
            },
        });

        return {
            status: HTTP_STATUS_CODES.CREATED,
            data: {
                message: SUCCESS_MESSAGES.COURSE_CREATED,
                course: newCourse,
            },
        };
    } catch (error) {
        return {
            status: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
            data: { message: ERROR_MESSAGES.ERROR_CREAT_COURSE },
        };
    }
};

const createCourseWithSubcourses = async ({ title, description, price, videoUrl, coverImage, subCourses }) => {
    try {

        const priceNumber = parseFloat(price);
        if (isNaN(priceNumber)) {
            throw new Error("Valor inválido para price");
        }

        const course = await prisma.course.create({
            data: {
                title,
                description,
                price: priceNumber,
                videoUrl,
                coverImage,
            },
        });

        // Criar subcursos como herança do curso principal
        const subCoursesData = subCourses.map(subCourse => ({
            title: subCourse.title,
            description: subCourse.description,
            price: parseFloat(subCourse.price), // Convertendo o preço para float
            videoUrl: subCourse.videoUrl,
            coverImage: subCourse.coverImage, // Incluindo a imagem de capa dos subcursos
            parentCourseId: course.id,
        }));

        await prisma.course.createMany({ data: subCoursesData });

        // Retornar curso com subcursos
        const courseWithSubcourses = await prisma.course.findUnique({
            where: { id: course.id },
            include: { subCourses: true },
        });

        return {
            status: HTTP_STATUS_CODES.CREATED,
            data: {
                message: SUCCESS_MESSAGES.COURSE_AND_SUBCOURSES_CREATED,
                course: courseWithSubcourses,
                subCourses: { count: subCourses.length },
            },
        };
    } catch (error) {
        return {
            status: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
            data: { message: ERROR_MESSAGES.ERROR_CREAT_COURSE_WITH_SUBCOURSES },
        };
    }
};

// Listar todos os cursos
const getCourses = async () => {
    try {
        const courses = await prisma.course.findMany({
            include: { subCourses: true }, // Inclui os subcursos ao listar cursos
        });
        return {
            status: HTTP_STATUS_CODES.OK,
            data: courses,
        };
    } catch (error) {
        return {
            status: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
            data: { message: ERROR_MESSAGES.ERROR_FETCH_COURSES },
        };
    }
};

// Buscar curso por ID
const getCourseById = async ({ id }) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: parseInt(id, 10) },
            include: { subCourses: true }, // Inclui os subcursos ao buscar por ID
        });

        if (!course) {
            return {
                status: HTTP_STATUS_CODES.NOT_FOUND,
                data: { message: ERROR_MESSAGES.COURSE_NOT_FOUND },
            };
        }

        return {
            status: HTTP_STATUS_CODES.OK,
            data: course,
        };
    } catch (error) {
        return {
            status: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
            data: { message: ERROR_MESSAGES.ERROR_FETCH_COURSE },
        };
    }
};

// Atualizar curso
const updateCourse = async ({ id, title, description, price, videoUrl, coverImage }) => {
    try {
        const updatedCourse = await prisma.course.update({
            where: { id: parseInt(id, 10) },
            data: {
                ...(title && { title }),
                ...(description && { description }),
                ...(price && { price }),
                ...(videoUrl && { videoUrl }),
                ...(coverImage && { coverImage }), // Atualizando a imagem de capa se fornecida
            },
        });

        return {
            status: HTTP_STATUS_CODES.OK,
            data: {
                message: SUCCESS_MESSAGES.COURSE_UPDATED,
                course: updatedCourse,
            },
        };
    } catch (error) {
        return {
            status: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
            data: { message: ERROR_MESSAGES.ERROR_UPDATE_COURSE },
        };
    }
};

// Deletar curso
const deleteCourse = async ({ id }) => {
    try {
        const courseId = parseInt(id, 10);

        // Verifica se existem cursos filhos com parentId igual ao ID do curso que está sendo deletado
        const subCourses = await prisma.course.findMany({
            where: { parentCourseId: courseId }
        });

        // Se houver cursos filhos, deleta todos primeiro
        if (subCourses.length > 0) {
            await prisma.course.deleteMany({
                where: { parentCourseId: courseId }
            });
        }

    

        await prisma.question.deleteMany({
            where: { courseId: courseId }
        });

        if (!courseId) {
            return {
                status: HTTP_STATUS_CODES.BAD_REQUEST,
                data: { message: ERROR_MESSAGES.INVALID_COURSE_ID },
            };
        }

        if(courseId === 0) {
            return {
                status: HTTP_STATUS_CODES.BAD_REQUEST,
                data: { message: ERROR_MESSAGES.COURSE_ID_ZERO },
            };
        }
        // Agora deleta o curso principal
        await prisma.course.delete({ where: { id: courseId } });


        return {
            status: HTTP_STATUS_CODES.NO_CONTENT,
            data: { message: SUCCESS_MESSAGES.COURSE_DELETED },
        };
    } catch (error) {
        return {
            status: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
            data: { message: ERROR_MESSAGES.ERROR_DELETE_COURSE },
        };
    }
};

const removeCursoDoUser = async ({ userId, courseId }) => {
    try {
        // Verificar se o curso existe
        const course = await prisma.course.findUnique({ where: { id: parseInt(courseId, 10) } });
        if (!course) {
            return {
                status: 404,
                data: { message: "Curso não encontrado" },
            };
        }

        // Verificar se o usuário existe
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId, 10) },
            include: { courses: true },
        });
        if (!user) {
            return {
                status: 404,
                data: { message: "Usuário não encontrado" },
            };
        }

        // Verificar se o curso está associado ao usuário
        const isAssociated = user.courses.some(c => c.id === course.id);
        if (!isAssociated) {
            return {
                status: 400,
                data: { message: "Curso não está associado ao usuário" },
            };
        }

        // Remover o curso do usuário
        await prisma.user.update({
            where: { id: parseInt(userId, 10) },
            data: {
                courses: {
                    disconnect: { id: parseInt(courseId, 10) },
                },
            },
        });

        return {
            status: 200,
            data: { message: "Curso removido do usuário com sucesso!" },
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: "Erro ao remover curso do usuário" },
        };
    }
};

const addQuestionToCourse  = async ({ courseId, title, options, answer  }) => {
    try {
        const course = await prisma.course.findUnique({ where: { id: parseInt(courseId, 10) } });
        if (!course) {
            return {
                status: 404,
                data: { message: "Curso não encontrado" },
            };
        }

        const question = await prisma.question.create({
            data: {
                title,
                options,
                answer,
                courseId: parseInt(courseId, 10),
            },
        });

        return {
            status: 200,
            data: { message: "Pergunta adicionada ao curso com sucesso!", question },
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: "Erro ao adicionar pergunta ao curso" },
        };
    }
}

const listarPerguntasDoCurso = async ({ courseId }) => {
    try {
        const course = await prisma.course.findUnique({ where: { id: parseInt(courseId, 10) } });
        if (!course) {
            return {
                status: 404,
                data: { message: "Curso não encontrado" },
            };
        }

        const questions = await prisma.question.findMany({
            where: { courseId: parseInt(courseId, 10) },
        });

        return {
            status: 200,
            data: questions,
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: "Erro ao listar perguntas do curso" },
        };
    }
}

const updateQuestion = async ({ questionId, title, options, answer }) => {
    try {
        const question = await prisma.question.findUnique({ where: { id: parseInt(questionId, 10) } });
        if (!question) {
            return {
                status: 404,
                data: { message: "Pergunta não encontrada" },
            };
        }

        const updatedQuestion = await prisma.question.update({
            where: { id: parseInt(questionId, 10) },
            data: {
                ...(title && { title }),
                ...(options && { options }),
                ...(answer && { answer }),
            },
        });

        return {
            status: 200,
            data: { message: "Pergunta atualizada com sucesso!", question: updatedQuestion },
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: "Erro ao atualizar pergunta" },
        };
    }
}

const deleteQuestion = async ({ questionId }) => {
    try {
        const question = await prisma.question.findUnique({ where: { id: parseInt(questionId, 10) } });
        if (!question) {
            return {
                status: 404,
                data: { message: "Pergunta não encontrada" },
            };
        }

        await prisma.question.delete({ where: { id: parseInt(questionId, 10) } });

        return {
            status: 200,
            data: { message: "Pergunta deletada com sucesso!" },
        };
    } catch (error) {
        return {
            status: 500,
            data: { message: "Erro ao deletar pergunta" },
        };
    }
}

module.exports = {
    createCourse,
    getCourses,
    getCourseById,
    updateCourse,
    deleteCourse,
    createCourseWithSubcourses,
    addCursoAoUser,
    removeCursoDoUser,
    createSTRIPECheckoutSession,
    addCursoStripeAoUser,
    addQuestionToCourse,
    listarPerguntasDoCurso,
    updateQuestion,
    deleteQuestion,
};