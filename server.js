const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'criar.html'));
});


let salas = {};
let salasProtegidas = {};
let jogadoresProntos = {};
const socketToSala = {};
let intervalos = {};


const palavras = {
    animais: ['abelha', 'viúva negra', 'avestruz', 'camarão', 'bode','bacalhau', 'cisne', 'koala', 'gorila', 'esquilo','grilo', 'hiena', 'iguana', 'beija flor', 'mocho','porco', 'polvo', 'ratazana', 'cegonha', 'gaivota'],
    filmes:  ['Star Wars', 'Harry Potter', 'Senhor dos Anéis', 'Rei Leão', 'Nemo','Titanic', '007', 'Vingadores', 'Batman', 'Avatar','Shrek', 'Toy Story', 'Carros', 'Velocidade Furiosa', 'Homem-Aranha','Transformers',],
    turma:  ['Rudraksh','Fonseca', 'David', 'Diana', 'Alexandra', 'Diogo','Filipe','Francisca', 'Dorin', 'Gonçalo Ramos', 'Mónica','Henrique', 'Margarida', 'Brito', 'Gonçalo Martins', 'Miguel','Costa', 'Jacinto', 'Ulisses', 'Rui', 'Tomás'],
    clubes:  ['Barcelona','Sporting', 'Benfica', 'Porto', 'Braga', 'Manchester United','Manchester City','Real Madrid', 'Atlético de Madrid', 'PSG', 'Milan','Juventus', 'Inter', 'Arsenal', 'Chelsea', 'Bayern Munique','Ajax', 'Dortmund', 'Tottenham'],
    países:  ['Croácia','Albânia', 'Reino Unido', 'Nova Zelândia', 'Canadá', 'Croreia do Sul','Argentina','Egito', 'Angola', 'Madagascar', 'Jamaica','Peru', 'Cabo Verde', 'Brasil', 'Bahamas', 'Uruguai','Índia', 'Dinamarca', 'Austrália', 'Grécia'],
    comidas:  ['tacos','cozido à portuguesa', 'bacalhau à brás', 'espinafre', 'canela', 'romã','bifana','pastel de nata', 'lasanha', 'amora', 'arroz','atum', 'sardinha', 'ostras', 'castanhas', 'iogurte','picanha', 'açaí', 'sal', 'costeleta','cheesecake','mousse de chocolate'],
    profissões:  ['bibliotecário','modelo', 'cozinheiro', 'astrônomo', 'jornalista', 'professor','bombeiro','árbitro', 'ator', 'enfermeiro', 'jardineiro','mecânico', 'pastor', 'realizador', 'surfista', 'treinador','veterinário', 'DJ', 'escultor', 'lutador'],
    marcas: ['Ralph Lauren', 'Ferrari', 'Lamborghini', 'Snapchat', 'KFC', 'Peugeot', 'Chrome', 'Starbucks', 'Puma', 'Olá', 'Red Bull', 'Android', 'NOS','Volkswagen', 'Jordan', 'Timberland', 'Santander', 'Discord'],
}; 
    

    
io.on("connection", (socket) => {
    console.log(`✅ Novo jogador conectado: ${socket.id}`);

    socket.on("entrarSala", ({ codigoSala, username, redirecionar = false, atualizar = false }) => {
        if (!salas[codigoSala]) {
            socket.emit("erro", "Sala não encontrada.");
            return;
        }
    
        let jogador = salas[codigoSala].jogadores.find(j => j.nome === username);
    
        if (jogador) {
            jogador.id = socket.id; // Atualiza o ID do socket (reconexão)
        } else {
            salas[codigoSala].jogadores.push({ id: socket.id, nome: username, pontos: 0 });
        }
        io.to(codigoSala).emit("atualizarJogadores", {
            jogadores: salas[codigoSala].jogadores,
            criador: salas[codigoSala].criador, 
        });
        socket.join(codigoSala);
        
        if (atualizar) {
            // Agora enviamos também o username correto de volta
       io.to(codigoSala).emit("atualizarJogadores", {
           jogadores: salas[codigoSala].jogadores,
           criador: salas[codigoSala].criador, 
       });
       }
    
        if (redirecionar) {
             // Agora enviamos também o username correto de volta
        io.to(codigoSala).emit("atualizarJogadores", {
            jogadores: salas[codigoSala].jogadores,
            criador: salas[codigoSala].criador,
            
        });
            socket.emit("salaValida");
        }
    
        console.log(`✅ Jogador ${username} entrou (ou reconectou) na sala ${codigoSala}`);
    });
    
    
    
    socket.on("iniciarJogo", ({ codigoSala, categoriasSelecionadas }) => {
        const sala = salas[codigoSala];
        if (sala) {
            sala.categorias = categoriasSelecionadas;
            
            io.to(codigoSala).emit("redirecionarParaJogo");
        }
    });

    socket.on("criarSala", (username) => {
        let codigoSala = Math.floor(1000 + Math.random() * 9000).toString();
        salas[codigoSala] = {
            jogadores: [{ id: socket.id, nome: username, pontos: 0 }],
            criador: username,
            criadorSocketId: socket.id, 
            categorias: [],
            palavrasUsadas: new Set(),
            desenhadoresUsados: new Set()
        };
        salasProtegidas[codigoSala] = true;
        socket.join(codigoSala);
        socket.emit("salaCriada", codigoSala);
    });

    socket.on("manterSala", (codigoSala) => {
        salasProtegidas[codigoSala] = true;
    });
       
    socket.on("iniciarRonda", ({ codigoSala }) => {
        const sala = salas[codigoSala];
        if (!sala) return;
        
        if (intervalos[codigoSala]) clearInterval(intervalos[codigoSala]);
        sala.tempoRestante = 80;
        console.log(`✅ contar tempo`);
        intervalos[codigoSala] = setInterval(() => {
            sala.tempoRestante -= 0.1;
            io.to(codigoSala).emit("atualizarTempo", { tempo: sala.tempoRestante });
    
            if (sala.tempoRestante <= 0) {
                clearInterval(intervalos[codigoSala]);
                io.to(codigoSala).emit("fimDaRonda", {
                    palavra: sala.palavraAtual,
                    jogadores: ordenarTop3(sala.jogadores),
                    pontos: 0,
                    
                }); 
            }
        }, 100); // ⏱️ envia de segundo em segundo
    
    })

    socket.on("botaoRonda", ({ codigoSala }) => {
        socket.to(codigoSala).emit('comecarRonda', { codigoSala });
    });

    socket.on("proximaRonda", ({ codigoSala }) => {
        console.log(`✅ A iniciar nova ronda na sala ${codigoSala}`);
        iniciarNovaRonda(codigoSala);
    });
    
    socket.on("jogadorPronto", ({ codigoSala, username }) => {
        if (!salas[codigoSala]) return;
    
        const sala = salas[codigoSala];
    
        
        
        console.log(`✅ Jogador ${username} (ID: ${socket.id}) está pronto na sala ${codigoSala}`);
    
        
          
            iniciarNovaRonda(codigoSala);
        
    });
    
    socket.on("palpite", ({ codigoSala, username, mensagem }) => {
        const sala = salas[codigoSala];
        if (!sala) return;
    
        if (mensagem.trim().toLowerCase() === sala.palavraAtual.toLowerCase()) {
            const desenhador = sala.jogadores.find(j => j.desenhador);
            const adivinhador = sala.jogadores.find(j => j.nome === username);
    
            const pontosGanhos = Math.floor(sala.tempoRestante * 10);
    
            if (desenhador) desenhador.pontos += pontosGanhos;
            if (adivinhador) adivinhador.pontos += pontosGanhos;
    
            clearInterval(intervalos[codigoSala]); // para o tempo
    
            // Envia resultado
            io.to(codigoSala).emit("fimDaRonda", {
                palavra: sala.palavraAtual,
                vencedor: username,
                jogadores: ordenarTop3(sala.jogadores),
                pontos: pontosGanhos,
                desenhador: desenhador
            });
        } else {
            // enviar palpite errado
            io.to(codigoSala).emit("palpiteRecebido", { username, mensagem });
        }
        
    });
    
    function ordenarTop3(jogadores) {
        return [...jogadores]
            .sort((a, b) => (b.pontos || 0) - (a.pontos || 0))
            .slice(0, 3)
            .map(j => ({ nome: j.nome, pontos: j.pontos }));
    }


    socket.on('comecarDesenho', (dados) => {
        socket.to(dados.codigoSala).emit('comecarDesenho', dados);
    });
    
    socket.on('desenhar', (dados) => {
        socket.to(dados.codigoSala).emit('desenhar', dados);
    });
    
    socket.on('pararDesenho', ({ codigoSala }) => {
        socket.to(codigoSala).emit('pararDesenho');
    });

    socket.on('limparCanvas', ({ codigoSala }) => {
        socket.to(codigoSala).emit('limparCanvas');
    });
    

});
    

    

function iniciarNovaRonda(codigoSala) {
    console.log(`✅ Iniciando nova ronda para a sala ${codigoSala}`);

    const sala = salas[codigoSala];
    if (!sala) return;

    // ⚡ Escolhe o desenhador
    let jogadoresDisponiveis = sala.jogadores.filter(j => !sala.desenhadoresUsados.has(j.id));
    
    if (jogadoresDisponiveis.length === 0) {
        sala.desenhadoresUsados.clear(); // Todos já desenharam? Reset!
        jogadoresDisponiveis = [...sala.jogadores];
    }

    const desenhador = jogadoresDisponiveis[Math.floor(Math.random() * jogadoresDisponiveis.length)];
    sala.desenhadoresUsados.add(desenhador.id);

    // Marca apenas ele como desenhador
    sala.jogadores.forEach(j => j.desenhador = false);
    desenhador.desenhador = true;

    // ⚡ Escolhe palavra
    const categoriasValidas = sala.categorias.filter(c => palavras[c]);
    if (categoriasValidas.length === 0) {
        console.log(`⚠️ Nenhuma categoria válida para a sala ${codigoSala}`);
        return;
    }

    let palavra, categoria;
    do {
        categoria = categoriasValidas[Math.floor(Math.random() * categoriasValidas.length)];
        palavra = palavras[categoria][Math.floor(Math.random() * palavras[categoria].length)];
    } while (sala.palavrasUsadas.has(palavra) && sala.palavrasUsadas.size < Object.values(palavras).flat().length);

    sala.palavraAtual = palavra;
    sala.palavrasUsadas.add(palavra);

    // ⚡ Atualiza o tempo
    const tempoRonda = 80;
    sala.tempoRestante = tempoRonda;

    // ⚡ Dispara evento para todos
    io.to(codigoSala).emit("novaRondaModal", {
        codigoSala,
        categoria,
        palavra,
        desenhadorId: desenhador.id,
        nomeDesenhador: desenhador.nome,
        tempo: tempoRonda,
        
    });
}



const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
});

