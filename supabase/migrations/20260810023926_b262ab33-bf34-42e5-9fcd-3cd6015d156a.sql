-- Permitir que usuários autenticados (como o Administrador logado) executem as funções de gerenciamento de roster
GRANT EXECUTE ON FUNCTION public.daily_roster_list(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_roster_add(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_roster_remove(uuid, text, uuid) TO authenticated;

-- Garantir acesso ao service_role
GRANT EXECUTE ON FUNCTION public.daily_roster_list(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.daily_roster_add(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.daily_roster_remove(uuid, text, uuid) TO service_role;
