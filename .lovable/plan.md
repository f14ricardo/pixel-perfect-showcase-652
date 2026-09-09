# Corrigir exibição de PE na consulta

## Alteração
- Carregar também os componentes que possuem notas em qualquer aluno da turma selecionada, além da configuração oficial da turma.
- Montar a grade com a união da matriz configurada e dos componentes detectados na turma, sem incluir disciplinas inexistentes nessa turma.
- Manter a ordem atual dos componentes e posicionar PE imediatamente depois de EF.
- Para alunos sem nota PE, mostrar a linha “PE — Práticas Esportivas” com “—” nas etapas vazias.

## Validação
- Abrir `/consulta` na prévia autenticada, selecionar uma turma com PE e um aluno sem nota PE.
- Confirmar que PE aparece depois de EF e que EF, PR e os demais componentes permanecem inalterados.
