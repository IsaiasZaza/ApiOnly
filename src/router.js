const express = require('express');
const {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    changeUserPassword,
    loginUser,
    forgotPassword,
    resetPassword,
    updateProfilePicture,
    addProfilePicture,
    removeProfilePicture,
    logoutUser,
    removeCursoDoUser,
    upload,
} = require('./controllers/userController');
const authenticateUser = require('./middlewares/authMiddlewares');
const { ERROR_MESSAGES, HTTP_STATUS_CODES } = require('./utils/enum');
const { createCourse, getCourses, getCourseById,
    updateCourse, deleteCourse, createCourseWithSubcourses, createSTRIPECheckoutSession,
    addCursoAoUser, addCursoStripeAoUser,
    addQuestionToCourse,
    listarPerguntasDoCurso,
    updateQuestion,
    deleteQuestion } = require('./controllers/courseController');
const { createEbook, getAllEbooks, getEbookById, updateEbook, deleteEbook } = require('./controllers/ebookController');
const router = express.Router();
const stripe = require('stripe')
const STRIPE = new stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-08-27' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient()
const { generateCertificate } = require('./controllers/certificateController')
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');


const client = new MercadoPagoConfig({
    accessToken: 'APP_USR-6595130337209466-051020-0376863cb45c4d8612ddcc9f565ea131-2427821890'
});
const payment = new Payment(client);
require('dotenv').config();

router.post('/checkout', async (req, res) => {
    try {
        const { courseId, userId } = req.body;

        if (!userId || !courseId) {
            return res.status(400).json({ message: 'userId e courseId são obrigatórios.' });
        }

        const existingPurchase = await prisma.purchase.findFirst({
            where: {
                userId: Number(userId),
                courseId: Number(courseId),
                status: 'approved',
            },
        });


        if (existingPurchase) {
            return res.status(400).json({ message: 'Você já comprou este curso.' });
        }

        const course = await prisma.course.findUnique({
            where: { id: Number(courseId) },
        });

        if (!course) {
            return res.status(404).json({ message: 'Curso não encontrado.' });
        }


        // Criação de uma nova preferência de pagamento
        const preference = new Preference(client);

        const response = await preference.create({
            body: {
                items: [
                    {
                        title: course.title,
                        unit_price: course.price,
                        description: course.description,
                        quantity: 1,
                    },
                ],
                metadata: {
                    userId: String(userId),
                    courseId: String(courseId),
                },
                back_urls: {
                    success: `${process.env.CLIENT_URL}/success?courseId=${courseId}&userId=${userId}`,
                    failure: `${process.env.CLIENT_URL}/cancel`,
                    pending: `${process.env.CLIENT_URL}/cancel`,
                },
                auto_return: 'approved',
                external_reference: JSON.stringify({ courseId, userId }),
                notification_url: 'https://crud-usuario.vercel.app/api/webhook/mercadopago',
            }
        })

        // Retorna a URL de pagamento para o front-end
        res.status(200).json({ init_point: response.init_point });
    } catch (error) {
        console.error('Erro ao criar preferência:', error.message || error);
        return res.status(500).json({ error: 'Erro ao criar preferência de pagamento', details: error.message || error });
    }
});

router.post('/pergunta', async (req, res) => {
    const { courseId, question } = req.body;
    const { title, options, answere } = question; // Adicionei a extração de title e answer aqui
    const { status, data } = await addQuestionToCourse({ title, options, courseId, question, answer: answere });
    return res.status(status).json(data);
});

router.get('/perguntas/:courseId', async (req, res) => {
    const { courseId } = req.params;
    const { status, data } = await listarPerguntasDoCurso({ courseId });
    return res.status(status).json(data);
});

router.put('/pergunta/:id', async (req, res) => {
    const { id } = req.params;
    const { question } = req.body;
    const { status, data } = await updateQuestion({ id, question });
    return res.status(status).json(data);
});

router.delete('/pergunta/:id', async (req, res) => {
    const { id } = req.params;
    const { status, data } = await deleteQuestion({ id });
    return res.status(status).json(data);
});


router.post('/certificado', async (req, res) => {
    const { studentName, courseName } = req.body;

    if (!studentName || !courseName) {
        return res.status(400).json({ message: 'studentName e courseName são obrigatórios.' });
    }

    try {
        const pdfData = await generateCertificate(studentName, courseName);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=certificate.pdf');
        return res.status(200).send(pdfData);
    } catch (error) {
        console.error('Erro ao gerar certificado:', error.message);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
});

router.post('/webhook', async (request, response) => {
    const sig = request.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(request.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Erro ao processar webhook:', err);
        return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                const { courseId, userId } = paymentIntent.metadata;
                const result = await addCursoStripeAoUser({ userId, courseId });
                console.log('Resultado da associação do curso:', result);
                break;
            }
            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object;
                const { last_payment_error } = paymentIntent;
                console.error(`Pagamento falhou: ${last_payment_error ? last_payment_error.message : 'Erro desconhecido'}`);
                break;
            }
            case 'payment_intent.created': {
                const paymentIntent = event.data.object;
                console.log('Novo PaymentIntent criado:', paymentIntent.id);
                // Lógica adicional, se necessário
                break;
            }
            case 'payment_intent.canceled': {
                const paymentIntent = event.data.object;
                console.log('PaymentIntent cancelado:', paymentIntent.id);
                // Lógica para lidar com cancelamentos, se necessário
                break;
            }
            default:
                console.log(`Evento não tratado: ${event.type}`);
        }
    } catch (error) {
        console.error('Erro no processamento do webhook:', error);
        return response.status(500).json({ error: 'Erro interno no servidor' });
    }

    // Confirma o recebimento do webhook após o processamento
    response.status(200).json({ received: true });
});


router.post('/checkout', async (req, res) => {
    // Extraia os parâmetros com os nomes corretos
    const { courseId, userId } = req.body;

    const { status, data } = await createSTRIPECheckoutSession({ courseId, userId });
    return res.status(status).json(data);
});

router.post('/ebook', async (req, res) => {
    const result = await createEbook(req.body);
    res.status(result.status).json(result.data);
})

router.get('/ebooks', async (req, res) => {
    const result = await getAllEbooks();
    res.status(result.status).json(result.data);
});

router.put('/ebook/:id', async (req, res) => {
    const result = await updateEbook({ id: req.params.id, ...req.body });
    res.status(result.status).json(result.data);
});

router.delete('/ebook/:id', async (req, res) => {
    const result = await deleteEbook(req.params);
    res.status(result.status).json(result.data);
});

router.get('/ebook/:id', async (req, res) => {
    const result = await getEbookById(req.params);
    res.status(result.status).json(result.data);
});

router.post('/adicionarCurso', async (req, res) => {
    const result = await addCursoAoUser(req.body);
    res.status(result.status).json(result.data);
});

router.post('/user', async (req, res) => {
    const { nome, email, senha, role, cpf, profissao } = req.body;
    const { status, data } = await createUser({ nome, email, senha, role, cpf, profissao });
    return res.status(status).json(data);
});

router.post('/login', async (req, res) => {
    const { email, senha, role } = req.body;

    if (!email || !senha) {
        return res
            .status(HTTP_STATUS_CODES.BAD_REQUEST)
            .json({ message: ERROR_MESSAGES.EMAIL_AND_PASSWORD_REQUIRED });
    }

    const { status, data } = await loginUser({ email, senha, role });
    return res.status(status).json(data);
});

router.get('/users', async (req, res) => {
    const { status, data } = await getUsers();
    return res.status(status).json(data);
});

router.get('/user/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { status, data } = await getUserById({ id });
    return res.status(status).json(data);
});

router.put('/user/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { nome, email, sobre, estado, cpf, profissao } = req.body;
    const { status, data } = await updateUser({ id, nome, email, sobre, estado, cpf, profissao });
    return res.status(status).json(data);
});

router.delete('/user/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { status, data } = await deleteUser({ id });
    return res.status(status).json(data);
});

router.put('/user/:id/change-password', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
        return res
            .status(HTTP_STATUS_CODES.BAD_REQUEST)
            .json({ message: ERROR_MESSAGES.PASSWORD_REQUIRED });
    }

    const { status, data } = await changeUserPassword({ id, senhaAtual, novaSenha });
    return res.status(status).json(data);
});

router.post('/forgot-password', async (req, res) => {
    console.log('Recebendo requisição na rota /forgot-password');
    try {
        const { email } = req.body;
        if (!email) {
            console.error('Email não informado');
            return res.status(400).json({ message: 'Email é obrigatório' });
        }

        const response = await forgotPassword({ email });
        console.log('Resposta da função forgotPassword:', response);

        res.status(response.status).send(response.data);
    } catch (error) {
        res.status(500).json({ message: 'Erro interno doservidor' });
    }
});

router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res
            .status(HTTP_STATUS_CODES.BAD_REQUEST)
            .json({ message: ERROR_MESSAGES.TOKEN_AND_PASSWORD_REQUIRED });
    }

    const { status, data } = await resetPassword({ token, password });
    return res.status(status).json(data);
});

router.post('/', async (req, res) => {
    const result = await createCourse(req.body);
    res.status(result.status).json(result.data);
});

router.get('/cursos', async (req, res) => {
    const result = await getCourses();
    res.status(result.status).json(result.data);
});

router.get('/curso/:id', async (req, res) => {
    const result = await getCourseById(req.params);
    res.status(result.status).json(result.data);
});

router.put('/curso/:id', async (req, res) => {
    const result = await updateCourse({ id: req.params.id, ...req.body });
    res.status(result.status).json(result.data);
});

router.delete('/curso/:id', async (req, res) => {
    const result = await deleteCourse(req.params);
    res.status(result.status).json(result.data);
});

const validateCourseInput = (body) => {
    const { title, description, price, subCourses } = body;
    if (!title || !description || !price || !subCourses || !Array.isArray(subCourses)) {
        return false;
    }
    return true;
};

// Rota para criar curso e subcursos
router.post('/courses', async (req, res) => {
    const { title, description, price, videoUrl, coverImage, subCourses } = req.body;

    // Validar entrada
    if (!validateCourseInput(req.body)) {
        return res.status(400).json({
            message: "Informações insuficientes para criar o curso e subcursos.",
        });
    }

    try {
        const result = await createCourseWithSubcourses({ title, description, price, videoUrl, coverImage, subCourses });

        return res.status(result.status).json(result.data);
    } catch (error) {
        console.error('Erro ao criar curso e subcursos:', error.message);
        return res.status(500).json({
            message: 'Erro ao criar curso e subcursos.',
        });
    }
});

router.put('/user/:id/profile-picture', upload, async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
        return res.status(400).json({ message: 'Nenhuma imagem foi enviada.' });
    }

    const { status, data } = await updateProfilePicture(id, `/uploads/${req.file.filename}`);
    return res.status(status).json(data);
});

router.delete('/user/:id/profile-picture', async (req, res) => {
    const { id } = req.params;
    const { status, data } = await removeProfilePicture({ id });
    return res.status(status).json(data);
});

router.post('/user/:id/profile-picture', async (req, res) => {
    const { id } = req.params;
    const { profilePicture } = req.body;
    const { status, data } = await addProfilePicture({ id, profilePicture });
    return res.status(status).json(data);
});

router.post('/user/logout', async (req, res) => {
    const { status, data } = await logoutUser(req, res);
    return res.status(status).json(data);
});

router.post('/removerCurso', async (req, res) => {
    const result = await removeCursoDoUser(req.body);
    res.status(result.status).json(result.data);
});

module.exports = router;
