// __tests__/courseController.test.js
jest.mock('../src/lib/prisma', () => ({
    prisma: {
        course: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findMany: jest.fn(),
        },
        subCourse: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findMany: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    }
}));

const { prisma } = require('../src/lib/prisma');

jest.mock('stripe', () => {
    const stripeMock = {
        checkout: {
            sessions: {
                create: jest.fn(),
            },
        },
    };
    return jest.fn().mockImplementation(() => stripeMock);
});


const {
    createCourse, getCourses, getCourseById,
    updateCourse, deleteCourse, createCourseWithSubcourses,
    createSTRIPECheckoutSession, addCursoAoUser,
    addCursoStripeAoUser, addQuestionToCourse,
    listarPerguntasDoCurso, updateQuestion, deleteQuestion,
    removeCursoDoUser, getAllUserCourses,
    getSubCoursesByCourseId, getSubCourseById
} = require('../src/controllers/courseController');

describe('Course Controller', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createCourse', () => {
        it('deve criar um curso com subcursos', async () => {
            const mockCourse = { id: 1, title: 'React Avançado', description: 'Curso top', price: 199.99, videoUrl: 'https://example.com/video', coverImage: 'https://example.com/image' };
            prisma.course.create.mockResolvedValue(mockCourse);

            const req = {
                id: 1, title: 'React Avançado', description: 'Curso top', price: 199.99, videoUrl: 'https://example.com/video', coverImage: 'https://example.com/image',
                subCourses: [
                    { title: 'Módulo 1', description: 'Intro', videoUrl: 'Vídeo 1', coverImage: 'Imagem 1', parentCourseId: 1, price: 49.99 },
                ],
            };

            const res = await createCourseWithSubcourses(req);

            expect(res.status).toBe(201);
            expect(prisma.course.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    name: 'React Avançado',
                    subCourses: {
                        create: [
                            { title: 'Módulo 1', description: 'Intro', videoUrl: 'Vídeo 1', coverImage: 'Imagem 1', parentCourseId: 1, price: 49.99 },
                        ],
                    },
                }),
            }));
        });

        it('deve retornar erro se falhar', async () => {
            prisma.course.create.mockRejectedValue(new Error('DB error'));
            const res = await createCourse({ name: 'Erro' });
            expect(res.status).toBe(500);
        });
    });

    describe('getAllCourses', () => {
        it('deve retornar todos os cursos', async () => {
            prisma.course.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
            const res = await getCourses();
            expect(res.status).toBe(200);
            expect(res.data.length).toBe(2);
        });

        it('deve retornar erro se o findMany falhar', async () => {
            prisma.course.findMany.mockRejectedValue(new Error('Erro'));
            const res = await getCourses();
            expect(res.status).toBe(500);
        });
    });

    describe('getCourseById', () => {
        it('deve retornar o curso se existir', async () => {
            prisma.course.findUnique.mockResolvedValue({ id: 1 });
            const res = await getCourseById(1);
            expect(res.status).toBe(200);
        });

        it('deve retornar 404 se não encontrar', async () => {
            prisma.course.findUnique.mockResolvedValue(null);
            const res = await getCourseById(99);
            expect(res.status).toBe(404);
        });
    });

    describe('addCursoAoUser', () => {
        it('deve adicionar curso ao usuário com sucesso', async () => {
            const mockUser = { id: 1, courses: [] };
            prisma.course.findUnique.mockResolvedValue({ id: 1 });
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue({});

            const res = await addCursoAoUser({ courseId: 1, userId: 1 });

            expect(res.status).toBe(200);
            expect(res.data.message).toMatch(/sucesso/i);
        });

        it('deve retornar erro se o curso já estiver associado', async () => {
            prisma.course.findUnique.mockResolvedValue({ id: 1 });
            prisma.user.findUnique.mockResolvedValue({
                id: 1,
                courses: [{ id: 1 }],
            });

            const res = await addCursoAoUser({ courseId: 1, userId: 1 });

            expect(res.status).toBe(400);
            expect(res.data.message).toMatch(/já está associado/i);
        });

        it('deve retornar erro se o usuário ou curso não existir', async () => {
            prisma.course.findUnique.mockResolvedValue(null);
            const res = await addCursoAoUser({ courseId: 1, userId: 1 });

            expect(res.status).toBe(404);
        });
    });

    describe('createSTRIPECheckoutSession', () => {
        it('deve criar uma sessão Stripe com sucesso', async () => {
            const course = { id: 1, name: 'Node', description: 'Curso', price: 99.99 };
            prisma.course.findUnique.mockResolvedValue(course);
            stripeMock.checkout.sessions.create.mockResolvedValue({ url: 'https://stripe.com/session' });

            const res = await createSTRIPECheckoutSession({ courseId: 1 });

            expect(res.status).toBe(200);
            expect(res.data.url).toMatch(/stripe/);
        });

        it('deve retornar 404 se curso não existir', async () => {
            prisma.course.findUnique.mockResolvedValue(null);
            const res = await createSTRIPECheckoutSession({ courseId: 999 });
            expect(res.status).toBe(404);
        });
    });

    describe('removeCursoDoUser', () => {
        it('deve remover um curso do usuário com sucesso', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 1,
                courses: [{ id: 1 }, { id: 2 }],
            });
            prisma.user.update.mockResolvedValue({});

            const res = await removeCursoDoUser({ userId: 1, courseId: 1 });

            expect(res.status).toBe(200);
            expect(res.data.message).toMatch(/removido/i);
        });

        it('deve retornar 404 se o curso não estiver associado ao usuário', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 1,
                courses: [{ id: 2 }],
            });

            const res = await removeCursoDoUser({ userId: 1, courseId: 1 });

            expect(res.status).toBe(404);
            expect(res.data.message).toMatch(/não encontrado/i);
        });

        it('deve retornar erro se o usuário não existir', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            const res = await removeCursoDoUser({ userId: 99, courseId: 1 });
            expect(res.status).toBe(404);
        });
    });

    describe('getAllUserCourses', () => {
        it('deve retornar todos os cursos do usuário', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 1,
                courses: [{ id: 1 }, { id: 2 }],
            });

            const res = await getAllUserCourses({ userId: 1 });

            expect(res.status).toBe(200);
            expect(res.data.length).toBe(2);
        });

        it('deve retornar erro se o usuário não existir', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            const res = await getAllUserCourses({ userId: 99 });

            expect(res.status).toBe(404);
        });
    });

    describe('createSubCourse', () => {
        it('deve criar um subcurso para um curso existente', async () => {
            prisma.course.findUnique.mockResolvedValue({ id: 1 });
            prisma.subCourse.create.mockResolvedValue({ id: 10 });

            const res = await createCourseWithSubcourses({
                courseId: 1,
                title: 'Sub 1',
                description: 'Intro',
                content: 'Vídeo 1',
            });

            expect(res.status).toBe(201);
            expect(prisma.subCourse.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    courseId: 1,
                }),
            }));
        });

        it('deve retornar erro se o curso não existir', async () => {
            prisma.course.findUnique.mockResolvedValue(null);

            const res = await createCourseWithSubcourses({
                courseId: 999,
                title: 'Sub',
            });

            expect(res.status).toBe(404);
        });
    });

    describe('deleteSubCourse', () => {
        it('deve deletar o subcurso com sucesso', async () => {
            prisma.subCourse.findUnique.mockResolvedValue({ id: 1 });
            prisma.subCourse.delete.mockResolvedValue({});

            const res = await deleteCourse({ subCourseId: 1 });

            expect(res.status).toBe(200);
            expect(res.data.message).toMatch(/deletado/i);
        });

        it('deve retornar 404 se o subcurso não for encontrado', async () => {
            prisma.subCourse.findUnique.mockResolvedValue(null);
            const res = await deleteCourse({ subCourseId: 999 });
            expect(res.status).toBe(404);
        });

        it('deve retornar erro se a deleção falhar', async () => {
            prisma.subCourse.findUnique.mockResolvedValue({ id: 1 });
            prisma.subCourse.delete.mockRejectedValue(new Error('Erro'));
            const res = await deleteCourse({ subCourseId: 1 });
            expect(res.status).toBe(500);
        });
    });

    describe('updateSubCourse', () => {
        it('deve atualizar um subcurso com sucesso', async () => {
            const mockSubCourse = { id: 1, title: 'Sub Atualizado' };
            prisma.subCourse.findUnique.mockResolvedValue({ id: 1 });
            prisma.subCourse.update.mockResolvedValue(mockSubCourse);

            const res = await updateCourse({
                subCourseId: 1,
                title: 'Sub Atualizado',
            });

            expect(res.status).toBe(200);
            expect(res.data.title).toBe('Sub Atualizado');
        });

        it('deve retornar 404 se o subcurso não existir', async () => {
            prisma.subCourse.findUnique.mockResolvedValue(null);
            const res = await updateCourse({ subCourseId: 999 });
            expect(res.status).toBe(404);
        });

        it('deve retornar erro se a atualização falhar', async () => {
            prisma.subCourse.findUnique.mockResolvedValue({ id: 1 });
            prisma.subCourse.update.mockRejectedValue(new Error('Erro'));
            const res = await updateCourse({ subCourseId: 1, title: 'Falha' });
            expect(res.status).toBe(500);
        });
    });

    describe('getSubCoursesByCourseId', () => {
        it('deve retornar subcursos de um curso existente', async () => {
            const mockSubCourses = [{ id: 1, title: 'Sub 1' }, { id: 2, title: 'Sub 2' }];
            prisma.subCourse.findMany.mockResolvedValue(mockSubCourses);
            prisma.course.findUnique.mockResolvedValue({ id: 1 });

            const res = await getSubCoursesByCourseId({ courseId: 1 });

            expect(res.status).toBe(200);
            expect(res.data.length).toBe(2);
        });

        it('deve retornar 404 se o curso não existir', async () => {
            prisma.course.findUnique.mockResolvedValue(null);
            const res = await getSubCoursesByCourseId({ courseId: 999 });
            expect(res.status).toBe(404);
        });
    });

    describe('getSubCourseById', () => {
        it('deve retornar um subcurso existente', async () => {
            const mockSubCourse = { id: 1, title: 'Sub 1' };
            prisma.subCourse.findUnique.mockResolvedValue(mockSubCourse);

            const res = await getCourseById({ subCourseId: 1 });
            expect(res.status).toBe(200);
            expect(res.data.title).toBe('Sub 1');
        });

        it('deve retornar 404 se o subcurso não existir', async () => {
            prisma.subCourse.findUnique.mockResolvedValue(null);
            const res = await getCourseById({ subCourseId: 999 });
            expect(res.status).toBe(404);
        });

    });

});
