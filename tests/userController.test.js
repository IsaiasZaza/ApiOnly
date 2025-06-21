// ✅ Mock do Prisma (direto no jest.mock, para evitar erro de escopo com Babel)
jest.mock('../src/lib/prisma', () => ({
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
}));

jest.mock('../src/lib/redis', () => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue('OK'),
    isOpen: true,
}));

// ✅ Mock do JWT Service
jest.mock('../src/services/jwtService', () => ({
    generateToken: jest.fn(() => 'mocked-jwt-token'),
}));

const bcrypt = require('bcrypt');
const prismaMock = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');
const {
    createUser,
    loginUser,
    getUserById,
    updateUser,
    deleteUser,
    getUsers,
    forgotPassword,
    resetPassword,
    changeUserPassword,
    updateProfilePicture,
    removeProfilePicture,
    addProfilePicture,
    logoutUser,
} = require('../src/controllers/userController');
const e = require('express');

describe('User Controller', () => {

    // ✅ createUser
    describe('createUser', () => {
        it('deve criar um novo usuário com sucesso', async () => {
            prismaMock.user.findUnique.mockResolvedValue(null);
            prismaMock.user.create.mockResolvedValue({
                id: 1,
                nome: 'Isaias',
                email: 'isaias1@example.com',
                role: 'ALUNO',
                estado: 'Brasília-DF',
                sobre: 'Bem-vindo(a) à Cetma',
                profilePicture: '',
                cpf: '71001992121',
                profissao: 'Dev',
            });

            const result = await createUser({
                nome: 'Isaias',
                email: 'isaias1@example.com',
                senha: 'Senha@123',
                cpf: '71001992121',
                profissao: 'Dev',
                role: 'aluno',
            });

            expect(result.status).toBe(201);
            expect(result.data.user.email).toBe('isaias1@example.com');
        });

        it('deve retornar 409 se CPF já existir', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ id: 1 });

            const result = await createUser({
                nome: 'Isaias',
                email: 'duplicado@example.com',
                senha: 'Senha@123',
                cpf: '71001992121',
                profissao: 'Dev',
                role: 'aluno',
            });

            expect(result.status).toBe(409);
        });

        it('deve retornar invalidRoles se a role for inválida', async () => {
            prismaMock.user.create.mockResolvedValue({
                id: 1,
                nome: 'Isaias',
                email: 'isaias1@example.com',
                role: 'PAPAICRIS',
                estado: 'Brasília-DF',
                sobre: 'Bem-vindo(a) à Cetma',
                profilePicture: '',
                cpf: '71001992121',
                profissao: 'Dev',
            });

            const result = await createUser({
                nome: 'Isaias',
                email: 'isaias1@example.com',
                senha: 'Senha@123',
                cpf: '71001992121',
                profissao: 'Dev',
                role: 'PAPAICRIS',
            });

            expect(result.status).toBe(400);
            expect(result.data).toEqual({ message: 'Função inválida. Escolha entre ADMIN, PROFESSOR ou ALUNO.' });
        });

        it('A senha precisa ter 8 caracteres, pelo menos uma letra maiúscula, um número e um caractere especial retorne erro', async () => {
            prismaMock.user.create.mockResolvedValue({
                id: 1,
                nome: 'Isaias',
                email: 'isaias1@example.com',
                role: 'PAPAICRIS',
                estado: 'Brasília-DF',
                sobre: 'Bem-vindo(a) à Cetma',
                profilePicture: '',
                cpf: '71001992121',
                profissao: 'Dev',
            });

            const result = await createUser({
                nome: 'Isaias',
                email: 'isaias1@example.com',
                senha: 'Senha13',
                cpf: '71001992121',
                profissao: 'Dev',
                role: 'aluno',
            });
            expect(result.status).toBe(400);
            expect(result.data).toEqual({ message: 'A senha deve ter no mínimo 8 caracteres e incluir pelo menos um caractere especial.' });

        })

        it('cpf deve ser invalido', async () => {
            prismaMock.user.create.mockResolvedValue({
                id: 1,
                nome: 'Isaias',
                email: 'isaias1@example.com',
                role: 'PAPAICRIS',
                estado: 'Brasília-DF',
                sobre: 'Bem-vindo(a) à Cetma',
                profilePicture: '',
                cpf: '22',
                profissao: 'Dev',
            });

            const result = await createUser({
                nome: 'Isaias',
                email: 'isaias1@example.com',
                senha: 'Senha123@',
                cpf: '22',
                profissao: 'Dev',
                role: 'aluno',
            });

            expect(result.status).toBe(400);
            expect(result.data).toEqual({ message: 'O CPF deve ser valido' });
        })

        describe('loginUser', () => {
            it('deve autenticar com sucesso', async () => {
                const senhaCriptografada = await bcrypt.hash('Senha@123', 10);

                prismaMock.user.findUnique.mockResolvedValue({
                    id: 1,
                    nome: 'Isaias',
                    email: 'isaias1@example.com',
                    senha: senhaCriptografada,
                    role: 'ALUNO',
                    courses: [],
                });

                const result = await loginUser({
                    email: 'isaias1@example.com',
                    senha: 'Senha@123',
                    role: 'ALUNO',
                });

                expect(result.status).toBe(200);
                expect(result.data).toHaveProperty('token');
            });

            it('deve retornar 404 se usuário não for encontrado no login', async () => {
                prismaMock.user.findUnique.mockResolvedValue(null);

                const result = await loginUser({
                    email: 'naoexiste@example.com',
                    senha: 'Senha@123',
                    role: 'ALUNO',
                });
                expect(result.data).toEqual({ message: 'Credenciais inválidas.' });
                expect(result.status).toBe(401);
            });

            it('deve retornar 401 se a senha estiver incorreta', async () => {
                const senhaCriptografada = await bcrypt.hash('SenhaErrada@123', 10);

                prismaMock.user.findUnique.mockResolvedValue({
                    id: 1,
                    nome: 'Isaias',
                    email: 'isaias@example.com',
                    senha: senhaCriptografada,
                    role: 'ALUNO',
                    courses: [],
                });

                const result = await loginUser({
                    email: 'isaias@example.com',
                    senha: 'a',
                    role: 'ALUNO',
                });

                expect(result.data).toEqual({ message: 'Credenciais inválidas.' });
                expect(result.status).toBe(401);
            });
        });

        // ✅ getUserById
        describe('getUserById', () => {
            it('deve retornar usuário por ID', async () => {
                prismaMock.user.findUnique.mockResolvedValue({
                    id: 1,
                    nome: 'Isaias',
                    email: 'isaias@example.com',
                    courses: [],
                });

                const result = await getUserById({ id: 1 });

                expect(result.status).toBe(200);
                expect(result.data.user.nome).toBe('Isaias');
            });

            it('deve retornar 404 se o usuário não existir', async () => {
                prismaMock.user.findUnique.mockResolvedValue(null);

                const result = await getUserById({ id: 999 });

                expect(result.data).toEqual({ message: 'Erro ao obter usuário por ID.' });
                expect(result.status).toBe(404);
            });
        });

        describe('updateUser', () => {
            it('deve atualizar usuário com sucesso', async () => {
                prismaMock.user.update.mockResolvedValue({
                    id: 1,
                    nome: 'Novo Nome',
                    email: 'novoemail@example.com',
                    estado: 'SP',
                    sobre: 'Sobre novo',
                    cpf: '71001992121',
                    profissao: 'Engenheiro',
                });

                const result = await updateUser({
                    id: 1,
                    nome: 'Novo Nome',
                    email: 'novoemail@example.com',
                    estado: 'SP',
                    sobre: 'Sobre novo',
                    profilePicture: '',
                    cpf: '71001992121',
                    profissao: 'Engenheiro'
                });

                expect(result.status).toBe(200);
                expect(result.data.message).toBe('Usuário atualizado com sucesso.');
                expect(result.data.user).toStrictEqual({
                    id: 1,
                    nome: 'Novo Nome',
                    email: 'novoemail@example.com',
                    estado: 'SP',
                    sobre: 'Sobre novo',
                    cpf: '71001992121',
                    profissao: 'Engenheiro'
                })

            });

            it('deve retornar 500 em caso de erro no updateUser', async () => {
                prismaMock.user.update.mockRejectedValue(new Error('Erro de atualização'));

                const result = await updateUser({
                    id: 1,
                    nome: 'Erro',
                    email: 'erro@example.com',
                    estado: 'SP',
                    sobre: 'Teste',
                    profilePicture: '',
                    senha: 'Senha@123',
                    cpf: '12345678900',
                    profissao: 'Tester',
                });

                expect(result.status).toBe(500);
                expect(result.data.message).toBe('Ocorreu um erro ao atualizar o usuário.');
            });
        });

        describe('deleteUser', () => {
            it('deve deletar usuário com sucesso', async () => {
                prismaMock.user.delete.mockResolvedValue({});

                const result = await deleteUser({ id: 1 });

                expect(result.status).toBe(204);
            });

            it('deve retornar 500 em caso de erro ao deletar usuário', async () => {
                prismaMock.user.delete.mockRejectedValue(new Error('Erro ao deletar'));

                const result = await deleteUser({ id: 1 });

                expect(result.status).toBe(500);
            });
        });


        // ✅ getUsers
        describe('getUsers', () => {
            it('deve retornar todos os usuários', async () => {
                prismaMock.user.findMany.mockResolvedValue([
                    { id: 1, nome: 'User 1', email: 'user1@example.com', senha: 'hash1' },
                    { id: 2, nome: 'User 2', email: 'user2@example.com', senha: 'hash2' },
                ]);

                const result = await getUsers();

                expect(result.status).toBe(200);
                expect(result.data.length).toBe(2);
            });
        });

        // ✅ forgotPassword
        describe('forgotPassword', () => {
            it('deve retornar 404 se usuário não encontrado', async () => {
                prismaMock.user.findUnique.mockResolvedValue(null);

                const result = await forgotPassword({ email: 'naoexiste@example.com' });

                expect(result.status).toBe(404);
            });

            it('deve iniciar recuperação de senha se usuário existir', async () => {
                prismaMock.user.findUnique.mockResolvedValue({
                    id: 1,
                    email: 'teste@example.com',
                });

                const result = await forgotPassword({ email: 'teste@example.com' });

                expect(result.status).toBe(200);
            });
        });

        // ✅ resetPassword
        describe('resetPassword', () => {
            it('deve retornar 404 se usuário não encontrado', async () => {
                jest.spyOn(jwt, 'verify').mockReturnValue({ id: 1 });
                prismaMock.user.findUnique.mockResolvedValue(null);

                const result = await resetPassword({ token: 'fake-token', password: 'NovaSenha@123' });

                expect(result.status).toBe(404);
                expect(result.data).toEqual({ message: 'Usuário não encontrado.' });
            });

            it('deve retornar 500 se falhar ao redefinir senha', async () => {
                jest.spyOn(jwt, 'verify').mockReturnValue({ id: 1 });
                prismaMock.user.findUnique.mockResolvedValue({ id: 1 });
                prismaMock.user.update.mockRejectedValue(new Error('Erro no update'));

                const result = await resetPassword({ token: 'fake-token', password: 'NovaSenha@123' });

                expect(result.status).toBe(500);
            });
        });

        // ✅ changeUserPassword
        describe('changeUserPassword', () => {
            it('deve retornar 404 se usuário não encontrado', async () => {
                prismaMock.user.findUnique.mockResolvedValue(null);

                const result = await changeUserPassword({
                    id: 1,
                    senhaAtual: 'Senha@123',
                    novaSenha: 'NovaSenha@123',
                });

                expect(result.status).toBe(404);
                expect(result.data).toEqual({ message: 'Usuário não encontrado.' });
            });

            it('deve retornar 401 se a senha atual estiver errada', async () => {
                const senhaCriptografada = await bcrypt.hash('SenhaErrada@123', 10);

                prismaMock.user.findUnique.mockResolvedValue({
                    id: 1,
                    senha: senhaCriptografada,
                });

                const result = await changeUserPassword({
                    id: 1,
                    senhaAtual: 'Senha@123',
                    novaSenha: 'NovaSenha@123',
                });

                expect(result.status).toBe(400);
                expect(result.data).toEqual({ message: 'Credenciais inválidas.' });
            });
        });

        // ✅ updateProfilePicture
        describe('updateProfilePicture', () => {
            it('deve atualizar foto de perfil com sucesso', async () => {
                prismaMock.user.update.mockResolvedValue({
                    id: 1,
                    nome: 'Isaias',
                    email: 'isaias1@example.com',
                    profilePicture: '/uploads/foto.png',
                });

                const result = await updateProfilePicture(1, '/uploads/foto.png');

                expect(result.status).toBe(200);
                expect(result.data.user.profilePicture).toBe('/uploads/foto.png');
            });

            it('deve retornar 500 se ocorrer erro ao atualizar foto de perfil', async () => {
                prismaMock.user.update.mockRejectedValue(new Error('Erro ao atualizar foto'));

                const result = await updateProfilePicture(1, '/uploads/erro.png');

                expect(result.status).toBe(500);
                expect(result.data.message).toBe('Erro interno no servidor.');
            });

            it('deve retornar 500 se ocorrer erro ao create foto de perfil', async () => {
                prismaMock.user.create.mockRejectedValue(new Error('Erro ao atualizar foto'));



                const result = await createUser(1, 'Erro ao criar usuário.');

                expect(result.status).toBe(500);
                expect(result.data.message).toBe('Erro interno no servidor.');
            });
        });

        // ✅ removeProfilePicture
        describe('removeProfilePicture', () => {
            it('deve remover foto de perfil', async () => {
                prismaMock.user.update.mockResolvedValue({
                    id: 1,
                    nome: 'Isaias',
                    email: 'isaias1@example.com',
                    profilePicture: null,
                });

                const result = await removeProfilePicture({ id: 1 });

                expect(result.status).toBe(200);
                expect(result.data.message).toBe('Foto de perfil removida com sucesso');
                expect(result.data.token).toBe('mocked-jwt-token');
                expect(result.data.user.profilePicture).toBe(null);
            });

            it('deve retornar 500 se falhar ao remover foto de perfil', async () => {
                prismaMock.user.update.mockRejectedValue(new Error('Erro ao remover'));

                const result = await removeProfilePicture({ id: 1 });

                expect(result.status).toBe(500);
            });
        });

        describe('addProfilePicture', () => {
            it('deve adicionar foto de perfil', async () => {
                prismaMock.user.update.mockResolvedValue({
                    id: 1,
                    nome: 'Isaias',
                    email: 'isaias1@example.com',
                    profilePicture: '/uploads/foto2.png',
                });

                const result = await addProfilePicture({
                    id: 1,
                    profilePicture: '/uploads/foto2.png',
                });

                expect(result.status).toBe(200);
                expect(result.data.message).toBe('Usuário atualizado com sucesso.');
                expect(result.data.token).toBe('mocked-jwt-token');
                expect(result.data.user.profilePicture).toBe('/uploads/foto2.png');
            });

            it('deve retornar 500 se falhar ao adicionar foto de perfil', async () => {
                prismaMock.user.update.mockRejectedValue(new Error('Erro ao adicionar'));

                const result = await addProfilePicture({
                    id: 1,
                    profilePicture: '/uploads/erro.png',
                });

                expect(result.status).toBe(500);
                expect(result.data.message).toBe(undefined);

            });
        });


    })
})
