"""
Sistema de Login e Cadastro - Horizon Wear
Projeto academico - EEEP Dona Creusa do Carmo Rocha

Sistema basico de autenticacao em Python puro (sem bibliotecas externas),
usando um arquivo JSON como "banco de dados" simples. As senhas nunca sao
guardadas em texto puro: sao protegidas com hash SHA-256 + salt aleatorio.

Como usar:
    python3 sistema_login.py

Um arquivo "usuarios.json" sera criado automaticamente na primeira vez
que alguem se cadastrar.
"""

import json
import os
import re
import hashlib
import secrets
import getpass
from datetime import datetime

ARQUIVO_USUARIOS = "usuarios.json"


# ============================================================
#  ARMAZENAMENTO (banco de dados em arquivo JSON)
# ============================================================

def carregar_usuarios():
    """Carrega os usuarios cadastrados a partir do arquivo JSON."""
    if not os.path.exists(ARQUIVO_USUARIOS):
        return {}
    with open(ARQUIVO_USUARIOS, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}


def salvar_usuarios(usuarios):
    """Salva o dicionario de usuarios no arquivo JSON."""
    with open(ARQUIVO_USUARIOS, "w", encoding="utf-8") as f:
        json.dump(usuarios, f, indent=4, ensure_ascii=False)


# ============================================================
#  SEGURANCA (hash de senha)
# ============================================================

def gerar_hash_senha(senha, salt=None):
    """
    Gera um hash seguro da senha usando SHA-256 + salt aleatorio.
    Retorna uma tupla (hash_hex, salt_hex).
    """
    if salt is None:
        salt = secrets.token_hex(16)
    senha_salgada = (salt + senha).encode("utf-8")
    hash_senha = hashlib.sha256(senha_salgada).hexdigest()
    return hash_senha, salt


def verificar_senha(senha_digitada, hash_armazenado, salt_armazenado):
    """Confere se a senha digitada bate com o hash armazenado."""
    hash_calculado, _ = gerar_hash_senha(senha_digitada, salt_armazenado)
    return hash_calculado == hash_armazenado


# ============================================================
#  VALIDACOES
# ============================================================

def email_valido(email):
    padrao = r"^[\w\.\-]+@[\w\-]+\.[a-zA-Z]{2,}$"
    return re.match(padrao, email) is not None


def senha_forte(senha):
    """Exige pelo menos 6 caracteres, com letra e numero."""
    if len(senha) < 6:
        return False
    tem_letra = any(c.isalpha() for c in senha)
    tem_numero = any(c.isdigit() for c in senha)
    return tem_letra and tem_numero


# ============================================================
#  CADASTRO
# ============================================================

def cadastrar_usuario():
    print("\n===== CADASTRO - HORIZON WEAR =====")
    usuarios = carregar_usuarios()

    nome = input("Nome completo: ").strip()
    while not nome:
        nome = input("Nome nao pode ser vazio. Digite seu nome: ").strip()

    while True:
        usuario = input("Escolha um nome de usuario: ").strip().lower()
        if not usuario:
            print("O nome de usuario nao pode ser vazio.")
        elif usuario in usuarios:
            print("Esse nome de usuario ja existe. Escolha outro.")
        else:
            break

    while True:
        email = input("E-mail: ").strip().lower()
        if email_valido(email):
            break
        print("E-mail invalido. Tente novamente (ex: nome@email.com).")

    while True:
        senha = getpass.getpass("Crie uma senha (min. 6 caracteres, com letra e numero): ")
        if not senha_forte(senha):
            print("Senha fraca. Use pelo menos 6 caracteres, com letras e numeros.")
            continue
        confirmacao = getpass.getpass("Confirme a senha: ")
        if senha != confirmacao:
            print("As senhas nao coincidem. Tente novamente.")
            continue
        break

    hash_senha, salt = gerar_hash_senha(senha)

    usuarios[usuario] = {
        "nome": nome,
        "email": email,
        "senha_hash": hash_senha,
        "salt": salt,
        "criado_em": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
    }
    salvar_usuarios(usuarios)
    print(f"\nCadastro concluido com sucesso! Bem-vindo(a), {nome}.\n")


# ============================================================
#  LOGIN
# ============================================================

def fazer_login():
    print("\n===== LOGIN - HORIZON WEAR =====")
    usuarios = carregar_usuarios()

    if not usuarios:
        print("Nenhum usuario cadastrado ainda. Faca o cadastro primeiro.\n")
        return None

    tentativas = 3
    while tentativas > 0:
        usuario = input("Usuario: ").strip().lower()
        senha = getpass.getpass("Senha: ")

        dados = usuarios.get(usuario)
        if dados and verificar_senha(senha, dados["senha_hash"], dados["salt"]):
            print(f"\nLogin realizado com sucesso! Bem-vindo(a), {dados['nome']}\n")
            return dados

        tentativas -= 1
        print(f"Usuario ou senha incorretos. Tentativas restantes: {tentativas}\n")

    print("Numero maximo de tentativas excedido. Tente novamente mais tarde.\n")
    return None


# ============================================================
#  AREA DO USUARIO (apos login)
# ============================================================

def area_do_usuario(dados_usuario):
    while True:
        print("===== AREA DO CLIENTE - HORIZON WEAR =====")
        print(f"Nome: {dados_usuario['nome']}")
        print(f"E-mail: {dados_usuario['email']}")
        print(f"Cadastrado em: {dados_usuario['criado_em']}")
        print("\n1. Sair da conta")
        print("2. Encerrar programa")
        opcao = input("Escolha uma opcao: ").strip()

        if opcao == "1":
            print("\nVoce saiu da sua conta.\n")
            break
        elif opcao == "2":
            print("\nAte logo!")
            raise SystemExit
        else:
            print("Opcao invalida.\n")


# ============================================================
#  MENU PRINCIPAL
# ============================================================

def menu_principal():
    while True:
        print("=" * 42)
        print("      HORIZON WEAR - Sistema de Acesso")
        print("=" * 42)
        print("1. Fazer login")
        print("2. Criar conta (cadastro)")
        print("3. Sair")
        opcao = input("Escolha uma opcao: ").strip()

        if opcao == "1":
            dados = fazer_login()
            if dados:
                area_do_usuario(dados)
        elif opcao == "2":
            cadastrar_usuario()
        elif opcao == "3":
            print("\nAte logo!")
            break
        else:
            print("Opcao invalida. Tente novamente.\n")


if __name__ == "__main__":
    menu_principal()
