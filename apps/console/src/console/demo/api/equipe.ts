import { ConsoleError, changeRoleInputSchema, equipeSchema, inviteInputSchema, ROLE_LABELS } from '../../schemas';
import type { EquipeApi } from '../../source';
import { requireFound } from '../context';
import type { DemoContext } from '../context';
import { slug } from '../organisations';

export function equipeApi(ctx: DemoContext): EquipeApi {
  const find = (id: string) => requireFound(ctx.state.operators.find((operator) => operator.id === id), 'Opérateur');
  const administrators = () => ctx.state.operators.filter((operator) => operator.role === 'administrateur' && operator.state === 'actif');

  return {
    list: () => {
      const operators = ctx.state.operators;
      return Promise.resolve(
        equipeSchema.parse({
          operators,
          counts: {
            all: operators.length,
            actif: operators.filter((operator) => operator.state === 'actif').length,
            invitation: operators.filter((operator) => operator.state === 'invitation').length,
          },
        }),
      );
    },

    invite: (rawInput) => {
      const input = inviteInputSchema.parse(rawInput);
      const email = input.email.toLowerCase();
      if (ctx.state.operators.some((operator) => operator.email === email)) throw new ConsoleError('conflict', 'Un opérateur existe déjà avec cette adresse.');
      const name = `${input.firstName} ${input.lastName}`;
      const id = slug(name);
      ctx.state.operators.push({
        id: ctx.state.operators.some((operator) => operator.id === id) ? `${id}-2` : id,
        name,
        email,
        role: input.role,
        twoFactor: false,
        lastLoginAt: null,
        invitedOn: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(ctx.clock()),
        state: 'invitation',
        self: false,
      });
      ctx.audit.record({
        type: 'equipe',
        title: 'Opérateur invité',
        context: `${name}, rôle ${ROLE_LABELS[input.role]}, invitation valable 48 heures`,
        action: 'Invitation',
        module: 'Équipe opérateur',
        request: 'POST /api/console/equipe/invitations',
        after: { Opérateur: name, Rôle: ROLE_LABELS[input.role] },
      });
      return Promise.resolve({ id });
    },

    changeRole: (id, rawInput) => {
      const input = changeRoleInputSchema.parse(rawInput);
      const operator = find(id);
      if (operator.self) throw new ConsoleError('forbidden', 'Vous ne pouvez pas modifier votre propre rôle.');
      if (operator.role === input.role) throw new ConsoleError('conflict', 'Cet opérateur a déjà ce rôle.');
      if (operator.role === 'administrateur' && administrators().length <= 1) throw new ConsoleError('forbidden', 'Il doit rester au moins un administrateur.');
      const previous = operator.role;
      operator.role = input.role;
      ctx.audit.record({
        type: 'droits',
        title: 'Rôle opérateur modifié',
        context: `${operator.name}, ${ROLE_LABELS[previous]} vers ${ROLE_LABELS[input.role]}`,
        action: 'Changement de rôle',
        resource: `Compte de ${operator.name}`,
        module: 'Équipe opérateur',
        request: `PUT /api/console/equipe/${id}/role`,
        before: { Rôle: ROLE_LABELS[previous] },
        after: { Rôle: ROLE_LABELS[input.role] },
      });
      return Promise.resolve();
    },

    setActive: (id, active) => {
      const operator = find(id);
      if (operator.self) throw new ConsoleError('forbidden', 'Vous ne pouvez pas désactiver votre propre accès.');
      if (!active && operator.role === 'administrateur' && administrators().length <= 1) throw new ConsoleError('forbidden', 'Il doit rester au moins un administrateur.');
      if (active && operator.state !== 'desactive') throw new ConsoleError('conflict', 'Cet accès n’est pas désactivé.');
      if (!active && operator.state === 'desactive') throw new ConsoleError('conflict', 'Cet accès est déjà désactivé.');
      operator.state = active ? 'actif' : 'desactive';
      ctx.audit.record({
        type: 'equipe',
        title: active ? 'Accès opérateur réactivé' : 'Accès opérateur désactivé',
        context: `${operator.name}, ${ROLE_LABELS[operator.role]}`,
        action: active ? 'Réactivation' : 'Désactivation',
        resource: `Compte de ${operator.name}`,
        module: 'Équipe opérateur',
        request: `PUT /api/console/equipe/${id}/acces`,
        before: { État: active ? 'Désactivé' : 'Actif' },
        after: { État: active ? 'Actif' : 'Désactivé' },
      });
      return Promise.resolve();
    },
  };
}
