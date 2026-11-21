<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Banking\BankingContext;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Organizations\ActivityContext as A;

beforeEach(function (): void {
    $this->travelTo(now()->setTimeFromTimeString(A::AUJOURDHUI)->setDate(2026, 11, 21));
    $this->scene = A::equipe();
    $this->org = $this->scene['org'];
});

function activiteLignes(mixed $reponse): array
{
    return array_values(array_filter($reponse->json('data'), fn (array $ligne): bool => ! in_array($ligne['action'], ['organization.created', 'organization_member.created'], true)));
}

function activiteIds(mixed $reponse): array
{
    return array_column(activiteLignes($reponse), 'id');
}

it('401 sans jeton sur le journal', function (): void {
    foreach ([A::url($this->org), A::url($this->org, '/'.Str::uuid()), A::url($this->org, '/export')] as $url) {
        $this->getJson($url)->assertUnauthorized();
    }
});

it('404 organization_not_found pour un compte étranger à l\'organisation', function (): void {
    M::basculer($this, M::titulaire(M::organisation()));

    $this->getJson(A::url($this->org))->assertNotFound()->assertJsonPath('code', 'organization_not_found');
});

it('lecture réservée : owner et admin lisent, accountant refusé, manager seulement avec une entité', function (): void {
    A::entree($this->org, 'organization.updated');
    $partie = (string) Str::uuid7();

    foreach (['owner', 'admin'] as $role) {
        M::basculer($this, $this->scene[$role]);
        $this->getJson(A::url($this->org))->assertOk();
    }

    M::basculer($this, $this->scene['accountant']);
    $this->getJson(A::url($this->org))->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    $this->getJson(A::url($this->org, '/'.Str::uuid()))->assertForbidden()->assertJsonPath('code', 'role_forbidden');

    M::basculer($this, $this->scene['manager']);
    $this->getJson(A::url($this->org))->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    $this->getJson(A::url($this->org, '?subject_type=party&subject_id='.$partie))->assertOk();
    $this->getJson(A::url($this->org, '/'.Str::uuid()))->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    $this->getJson(A::url($this->org, '/export'))->assertForbidden()->assertJsonPath('code', 'role_forbidden');
});

it('une entrée d\'une autre organisation n\'est jamais servie : liste, détail, historique d\'entité, filtre par auteur, export', function (): void {
    $autre = M::organisation();
    $auteur = User::factory()->create(['name' => 'Étranger']);
    $partie = (string) Str::uuid7();
    $ici = A::entree($this->org, 'parties.party.anonymized', ['subject_type' => 'party', 'subject_id' => $partie, 'actor_user_id' => $this->scene['owner']->id, 'route' => 'parties.anonymize']);
    $la = A::entree($autre, 'parties.party.anonymized', ['subject_type' => 'party', 'subject_id' => $partie, 'actor_user_id' => $auteur->id, 'route' => 'parties.anonymize']);

    M::basculer($this, $this->scene['owner']);

    $liste = $this->getJson(A::url($this->org))->assertOk();
    expect(activiteIds($liste))->toBe([$ici->id]);

    $this->getJson(A::url($this->org, '/'.$la->id))->assertNotFound()->assertJsonPath('code', 'activity_not_found');
    $this->getJson(A::url($this->org, '?subject_type=party&subject_id='.$partie))->assertOk()->assertJsonCount(1, 'data');
    $this->getJson(A::url($this->org, '?actor='.$auteur->id))->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(A::url($this->org, '/'.$ici->id))->assertOk()->assertJsonPath('data.id', $ici->id);

    M::basculer($this, $this->scene['manager']);
    $historique = $this->getJson(A::url($this->org, '?subject_type=party&subject_id='.$partie))->assertOk();
    expect(array_column($historique->json('data'), 'id'))->toBe([$ici->id]);
});

it('les entrées sans organisation, les connexions et les actes internes de la plateforme ne sont pas servis', function (): void {
    foreach (['auth.login.succeeded', 'console.activity.listed', 'console.account.suspended', 'operations.approval.executed', 'identity.operator.granted', 'subscriptions.override.granted'] as $action) {
        A::entree($this->org, $action);
    }
    A::entree(null, 'parties.party.anonymized');
    A::entree($this->org, 'parties.party.imported');

    M::basculer($this, $this->scene['owner']);

    expect(array_column(activiteLignes($this->getJson(A::url($this->org))->assertOk()), 'action'))->toBe(['parties.party.imported']);
});

it('sert les accès du support sous « Support eGuardImmo », sans identité d\'opérateur ni détail', function (): void {
    $operateur = User::factory()->create(['name' => 'Opératrice Secrète']);
    $lecture = A::entree($this->org, 'console.support_access.read', ['actor_user_id' => $operateur->id, 'route' => 'messaging.console.tickets.show', 'ip' => '203.0.113.9', 'metadata' => ['ticket' => 'x', 'operator_email' => 'op@exemple.fr']]);
    A::entree($this->org, 'messaging.support_access.requested', ['actor_user_id' => $operateur->id, 'route' => 'messaging.console.access.request', 'ip' => '203.0.113.9']);

    M::basculer($this, $this->scene['owner']);
    $liste = $this->getJson(A::url($this->org))->assertOk();

    expect(array_column(array_column(activiteLignes($liste), 'actor'), 'name'))->toBe(['Support eGuardImmo', 'Support eGuardImmo'])
        ->and(array_column(array_column(activiteLignes($liste), 'actor'), 'id'))->toBe([null, null])
        ->and(array_column(activiteLignes($liste), 'ip'))->toBe([null, null])
        ->and($liste->getContent())->not->toContain('Opératrice')->not->toContain($operateur->id)->not->toContain('203.0.113');

    $detail = $this->getJson(A::url($this->org, '/'.$lecture->id))->assertOk();
    expect($detail->json('data.metadata'))->toBe([])->and($detail->getContent())->not->toContain('op@exemple.fr');
});

it('n\'affiche que les 12 derniers mois', function (): void {
    A::entree($this->org, 'parties.party.imported', ['occurred_at' => now()->subMonths(12)->subMinute()]);
    $recente = A::entree($this->org, 'parties.party.imported', ['occurred_at' => now()->subMonths(12)->addMinute()]);

    M::basculer($this, $this->scene['owner']);

    expect(activiteIds($this->getJson(A::url($this->org))->assertOk()))->toBe([$recente->id]);
});

it('expurge l\'origine : IP tronquée, appareil réduit, rien pour un compte externe', function (): void {
    $membre = $this->scene['admin'];
    $navigateur = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    $v4 = A::entree($this->org, 'organization.updated', ['actor_user_id' => $membre->id, 'route' => 'organizations.update', 'ip' => '81.250.12.34', 'user_agent' => $navigateur, 'occurred_at' => now()->subMinutes(1)]);
    $v6 = A::entree($this->org, 'organization.updated', ['actor_user_id' => $membre->id, 'route' => 'organizations.update', 'ip' => '2001:db8:abcd:12:aaaa:bbbb:cccc:dddd', 'user_agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Safari/604.1', 'occurred_at' => now()->subMinutes(2)]);
    $locataire = User::factory()->create(['name' => 'Jean Locataire']);
    $externe = A::entree($this->org, 'inspection_remark.created', ['actor_user_id' => $locataire->id, 'route' => 'inspections.tenant.remarks.store', 'ip' => '198.51.100.7', 'user_agent' => $navigateur, 'occurred_at' => now()->subMinutes(3)]);
    $systeme = A::entree($this->org, 'rent.notice.issued', ['occurred_at' => now()->subMinutes(4), 'ip' => '10.0.0.1']);

    M::basculer($this, $this->scene['owner']);
    $lignes = collect(activiteLignes($this->getJson(A::url($this->org))->assertOk()))->keyBy('id');

    expect($lignes[$v4->id]['ip'])->toBe('81.250.12.0/24')->and($lignes[$v4->id]['device'])->toBe('Chrome sur macOS')
        ->and($lignes[$v6->id]['ip'])->toBe('2001:db8:abcd::/48')->and($lignes[$v6->id]['device'])->toBe('Safari sur iOS')
        ->and($lignes[$externe->id]['actor'])->toBe(['kind' => 'tenant', 'id' => null, 'name' => 'Locataire', 'active' => null])
        ->and($lignes[$externe->id]['ip'])->toBeNull()->and($lignes[$externe->id]['device'])->toBeNull()
        ->and($lignes[$systeme->id]['actor']['name'])->toBe('Système')->and($lignes[$systeme->id]['ip'])->toBeNull();
});

it('nomme l\'auteur membre, y compris un ex-membre désactivé ou retiré, marqué inactif', function (): void {
    $actif = $this->scene['admin'];
    $desactive = M::membre($this->org, MemberRole::Manager);
    $retire = M::membre($this->org, MemberRole::Manager);
    M::dans($this->org, function () use ($desactive, $retire): void {
        OrganizationMember::query()->where('user_id', $desactive->id)->update(['status' => MemberStatus::Disabled, 'disabled_at' => now()]);
        OrganizationMember::query()->where('user_id', $retire->id)->firstOrFail()->delete();
    });
    $retire->delete();
    $entrees = [];

    foreach ([$actif, $desactive, $retire] as $i => $u) {
        $entrees[$u->id] = A::entree($this->org, 'organization.updated', ['actor_user_id' => $u->id, 'route' => 'organizations.update', 'occurred_at' => now()->subMinutes($i + 1)]);
    }

    M::basculer($this, $this->scene['owner']);
    $acteurs = collect(activiteLignes($this->getJson(A::url($this->org))->assertOk()))->pluck('actor')->keyBy('id');

    expect($acteurs[$actif->id]['active'])->toBeTrue()->and($acteurs[$actif->id]['name'])->toBe($actif->name)
        ->and($acteurs[$desactive->id]['active'])->toBeFalse()->and($acteurs[$desactive->id]['name'])->toBe($desactive->name)
        ->and($acteurs[$retire->id]['active'])->toBeFalse()->and($acteurs[$retire->id]['name'])->toBe($retire->name);
});

it('le détail sert le différentiel avec les données personnelles masquées, une métadonnée en liste blanche et la référence', function (): void {
    $entree = A::entree($this->org, 'parties.party.imported', [
        'actor_user_id' => $this->scene['owner']->id,
        'route' => 'parties.import',
        'changes' => ['display_name' => ['old' => 'Ancien', 'new' => '[masqué]'], 'email' => ['old' => 'secret@exemple.fr', 'new' => 'nouveau@exemple.fr'], 'iban_last4' => ['old' => null, 'new' => '1234'], 'language' => ['old' => 'fr', 'new' => 'en']],
        'metadata' => ['count' => 12, 'row_emails' => ['a@b.fr'], 'token' => 'jeton-secret'],
    ]);

    M::basculer($this, $this->scene['admin']);
    $detail = $this->getJson(A::url($this->org, '/'.$entree->id))->assertOk();

    expect($detail->json('data.changes.email'))->toBe(['old' => '[masqué]', 'new' => '[masqué]'])
        ->and($detail->json('data.changes.iban_last4'))->toBe(['old' => null, 'new' => '[masqué]'])
        ->and($detail->json('data.changes.language'))->toBe(['old' => 'fr', 'new' => 'en'])
        ->and($detail->json('data.metadata'))->toBe(['count' => 12])
        ->and($detail->json('data.reference'))->toBe($entree->request_id)
        ->and($detail->getContent())->not->toContain('secret@exemple.fr')->not->toContain('jeton-secret')->not->toContain('a@b.fr');
});

it('le gestionnaire lit l\'historique d\'une entité sans différentiel, origine, appareil ni référence', function (): void {
    $partie = (string) Str::uuid7();
    A::entree($this->org, 'party.updated', ['subject_type' => 'party', 'subject_id' => $partie, 'actor_user_id' => $this->scene['admin']->id, 'route' => 'parties.update', 'ip' => '81.250.12.34', 'user_agent' => 'Chrome/1', 'changes' => ['language' => ['old' => 'fr', 'new' => 'en']]]);

    M::basculer($this, $this->scene['manager']);
    $reponse = $this->getJson(A::url($this->org, '?subject_type=party&subject_id='.$partie))->assertOk();

    expect(array_keys($reponse->json('data.0')))->toBe(['id', 'occurred_at', 'type', 'label', 'actor', 'subject'])
        ->and($reponse->getContent())->not->toContain('81.250')->not->toContain('Chrome')->not->toContain('changes')->not->toContain('reference');
});

it('filtre par type, auteur et entité ; le type suit le catalogue d\'actions', function (): void {
    $a = A::entree($this->org, 'rent.payment.recorded', ['actor_user_id' => $this->scene['admin']->id, 'route' => 'rent.payments.store', 'occurred_at' => now()->subMinutes(1)]);
    $b = A::entree($this->org, 'organization_member.updated', ['actor_user_id' => $this->scene['owner']->id, 'route' => 'organizations.members.update', 'occurred_at' => now()->subMinutes(2)]);
    $c = A::entree($this->org, 'charges.statement.downloaded', ['occurred_at' => now()->subMinutes(3)]);
    $d = A::entree($this->org, 'foo.bar.baz', ['occurred_at' => now()->subMinutes(4)]);

    M::basculer($this, $this->scene['owner']);
    $ids = fn (string $requete): array => activiteIds($this->getJson(A::url($this->org, $requete))->assertOk());

    expect($ids('?type=paiement'))->toBe([$a->id])
        ->and($ids('?type=droits'))->toBe([$b->id])
        ->and($ids('?type=export'))->toBe([$c->id])
        ->and($ids('?type=autre'))->toBe([$d->id])
        ->and($ids('?type=document'))->toBe([])
        ->and($ids('?actor='.$this->scene['admin']->id))->toBe([$a->id])
        ->and($ids(''))->toBe([$a->id, $b->id, $c->id, $d->id]);

    $this->getJson(A::url($this->org, '?type=connexion'))->assertUnprocessable();
});

it('la période est semi-ouverte, en jours de l\'organisation, et ne dépasse pas 366 jours', function (): void {
    $this->org->forceFill(['timezone' => 'Europe/Paris'])->save();
    $avant = A::entree($this->org, 'parties.party.imported', ['occurred_at' => '2026-11-14 22:59:59']);
    $debut = A::entree($this->org, 'parties.party.imported', ['occurred_at' => '2026-11-14 23:00:00']);
    $fin = A::entree($this->org, 'parties.party.imported', ['occurred_at' => '2026-11-15 22:59:59']);
    $exclue = A::entree($this->org, 'parties.party.imported', ['occurred_at' => '2026-11-15 23:00:00']);

    M::basculer($this, $this->scene['owner']);
    $ids = activiteIds($this->getJson(A::url($this->org, '?from=2026-11-15&to=2026-11-16'))->assertOk());

    expect($ids)->toContain($debut->id, $fin->id)->not->toContain($avant->id, $exclue->id);

    $this->getJson(A::url($this->org, '?from=2025-11-01&to=2026-11-03'))->assertUnprocessable()->assertJsonPath('code', 'activity_range_too_wide');
    $this->getJson(A::url($this->org, '?from=2025-11-01&to=2026-11-02'))->assertOk();
    $this->getJson(A::url($this->org, '?from=2026-11-16&to=2026-11-15'))->assertUnprocessable();
});

it('pagine par curseur, sans total, sans doublon ni saut', function (): void {
    foreach (range(1, 5) as $i) {
        A::entree($this->org, 'parties.party.imported', ['occurred_at' => now()->subMinutes($i)]);
    }

    M::basculer($this, $this->scene['owner']);
    $premiere = $this->getJson(A::url($this->org, '?per_page=2'))->assertOk();
    $vues = activiteIds($premiere);
    $curseur = $premiere->json('meta.next_cursor');
    expect($premiere->json('meta'))->not->toHaveKey('total');

    while ($curseur !== null) {
        $page = $this->getJson(A::url($this->org, '?per_page=2&cursor='.urlencode($curseur)))->assertOk();
        $vues = [...$vues, ...activiteIds($page)];
        $curseur = $page->json('meta.next_cursor');
    }

    expect($vues)->toHaveCount(5)->and(array_unique($vues))->toHaveCount(5);
    $this->getJson(A::url($this->org, '?cursor=n-importe-quoi'))->assertUnprocessable();
    $this->getJson(A::url($this->org, '?per_page=101'))->assertUnprocessable();
});

it('un nombre de requêtes constant pour 1, 10 et 100 entrées', function (): void {
    M::basculer($this, $this->scene['owner']);
    $mesures = [];

    foreach ([1, 10, 100] as $total) {
        AuditLog::query()->where('organization_id', $this->org->id)->count();
        $existantes = AuditLog::query()->where('organization_id', $this->org->id)->where('action', 'parties.party.imported')->count();

        foreach (range($existantes + 1, $total) as $i) {
            A::entree($this->org, 'parties.party.imported', ['actor_user_id' => User::factory()->create()->id, 'route' => 'parties.import', 'occurred_at' => now()->subSeconds($i)]);
        }

        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson(A::url($this->org, '?per_page=100'))->assertOk();
        $mesures[$total] = count(DB::getQueryLog());
        DB::disableQueryLog();
    }

    expect($mesures[10])->toBe($mesures[1])->and($mesures[100])->toBe($mesures[1]);
});

it('le journal n\'a aucune route d\'écriture', function (): void {
    M::basculer($this, $this->scene['owner']);
    $entree = A::entree($this->org, 'parties.party.imported');

    foreach (['postJson', 'putJson', 'patchJson', 'deleteJson'] as $methode) {
        foreach ([A::url($this->org), A::url($this->org, '/'.$entree->id)] as $url) {
            expect($this->{$methode}($url, [])->status())->toBeIn([404, 405]);
        }
    }

    expect(AuditLog::query()->whereKey($entree->id)->exists())->toBeTrue();
});

it('la liste n\'est pas journalisée', function (): void {
    A::entree($this->org, 'parties.party.imported');
    M::basculer($this, $this->scene['owner']);
    $avant = AuditLog::query()->count();

    $this->getJson(A::url($this->org))->assertOk();
    $this->getJson(A::url($this->org, '/'.AuditLog::query()->latest('occurred_at')->value('id')))->assertOk();

    expect(AuditLog::query()->count())->toBe($avant);
});

it('l\'export exige une réauthentification récente', function (): void {
    M::basculer($this, $this->scene['owner']);

    $this->getJson(A::url($this->org, '/export'))->assertStatus(403);
});

it('l\'export CSV est audité, neutralise les formules et ne contient que les colonnes prévues', function (): void {
    $pirate = User::factory()->create(['name' => '=1+1']);
    M::dans($this->org, fn () => OrganizationMember::query()->create([
        'user_id' => $pirate->id, 'email' => mb_strtolower($pirate->email), 'first_name' => 'X', 'last_name' => 'Y',
        'role' => MemberRole::Manager, 'status' => MemberStatus::Active, 'joined_at' => now(),
    ]));
    A::entree($this->org, 'parties.party.imported', ['actor_user_id' => $pirate->id, 'route' => 'parties.import', 'ip' => '81.250.12.34', 'changes' => ['email' => ['old' => 'a@b.fr', 'new' => 'c@d.fr']]]);

    M::basculer($this, $this->scene['owner']);
    BankingContext::reauthentifier($this);
    $avant = AuditLog::query()->where('action', 'organizations.activity.exported')->count();

    $reponse = $this->get(A::url($this->org, '/export?from=2026-11-01&to=2026-11-22'), ['Accept' => 'text/csv']);
    $reponse->assertOk();
    $csv = $reponse->streamedContent();

    expect($reponse->headers->get('Content-Type'))->toContain('text/csv')
        ->and($reponse->headers->get('Cache-Control'))->toContain('no-store')
        ->and($csv)->toContain('"date";"type";"libelle";"auteur";"entite";"entite_id";"action";"origine";"appareil"')
        ->and($csv)->toContain('"\'=1+1"')
        ->and($csv)->not->toContain('"=1+1"')
        ->and($csv)->not->toContain('a@b.fr')->not->toContain('c@d.fr')->not->toContain('81.250.12.34')
        ->and(AuditLog::query()->where('action', 'organizations.activity.exported')->count())->toBe($avant + 1);

    $audit = AuditLog::query()->where('action', 'organizations.activity.exported')->latest('occurred_at')->firstOrFail();
    expect($audit->metadata)->toHaveKeys(['from', 'to', 'rows'])->and($audit->organization_id)->toBe($this->org->id);
});

it('l\'export refuse un volume trop grand sans rien écrire', function (): void {
    config(['organizations.activity.export_max_rows' => 1]);
    A::entree($this->org, 'parties.party.imported');
    A::entree($this->org, 'parties.party.imported');

    M::basculer($this, $this->scene['owner']);
    BankingContext::reauthentifier($this);
    $avant = AuditLog::query()->count();

    $this->getJson(A::url($this->org, '/export'))->assertUnprocessable()->assertJsonPath('code', 'activity_export_too_large');
    expect(AuditLog::query()->count())->toBe($avant);
});

it('l\'export est limité à 5 par heure', function (): void {
    M::basculer($this, $this->scene['owner']);
    BankingContext::reauthentifier($this);

    foreach (range(1, 5) as $_) {
        $this->get(A::url($this->org, '/export'))->assertOk()->streamedContent();
    }

    $this->get(A::url($this->org, '/export'))->assertStatus(429);
});

it('fuseau de l\'organisation : défaut par pays, modification réservée à owner et admin, IANA seulement', function (): void {
    expect($this->org->fresh()->timezone)->toBe('Europe/Paris');
    $url = "/api/v1/org/{$this->org->id}";

    foreach (['manager', 'accountant'] as $role) {
        M::basculer($this, $this->scene[$role]);
        $this->patchJson($url, ['timezone' => 'America/Toronto'])->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    }

    M::basculer($this, $this->scene['admin']);
    $this->patchJson($url, ['timezone' => 'Pacific/Nope'])->assertUnprocessable();
    $this->patchJson($url, ['timezone' => '+02:00'])->assertUnprocessable();
    $this->patchJson($url, ['timezone' => ''])->assertUnprocessable();
    $this->patchJson($url, [])->assertUnprocessable();
    $this->patchJson($url, ['timezone' => 'America/Toronto', 'country' => 'US', 'kind' => 'individual'])->assertOk()->assertJsonPath('data.timezone', 'America/Toronto');

    $org = $this->org->fresh();
    expect($org->timezone)->toBe('America/Toronto')->and($org->country)->not->toBe('US');
    expect(AuditLog::query()->where('action', 'organization.updated')->where('organization_id', $org->id)->exists())->toBeTrue();

    M::basculer($this, $this->scene['owner']);
    $this->patchJson($url, ['timezone' => 'Europe/Paris'])->assertOk();
});

it('fuseau : 401 sans jeton et 404 pour une autre organisation', function (): void {
    $url = "/api/v1/org/{$this->org->id}";
    $this->patchJson($url, ['timezone' => 'Europe/Paris'])->assertUnauthorized();

    M::basculer($this, M::titulaire(M::organisation()));
    $this->patchJson($url, ['timezone' => 'Europe/Paris'])->assertNotFound()->assertJsonPath('code', 'organization_not_found');
});

it('classe « autre compte », sans identité ni origine, un locataire ou un mandant qui accepte son invitation (liste et export)', function (string $route, string $action): void {
    $invite = User::factory()->create(['name' => 'Camille Invitée']);
    $entree = A::entree($this->org, $action, ['actor_user_id' => $invite->id, 'route' => $route, 'ip' => '198.51.100.77', 'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36']);

    M::basculer($this, $this->scene['owner']);
    $liste = $this->getJson(A::url($this->org))->assertOk();
    $ligne = collect(activiteLignes($liste))->firstWhere('id', $entree->id);

    expect($ligne['actor'])->toBe(['kind' => 'other', 'id' => null, 'name' => 'Autre compte', 'active' => null])
        ->and($ligne['ip'])->toBeNull()->and($ligne['device'])->toBeNull()
        ->and($liste->getContent())->not->toContain('Camille')->not->toContain($invite->id)->not->toContain('198.51.100');
    $detail = $this->getJson(A::url($this->org, '/'.$entree->id))->assertOk();
    expect($detail->getContent())->not->toContain('Camille')->not->toContain($invite->id)->not->toContain('198.51.100');

    BankingContext::reauthentifier($this);
    $csv = $this->get(A::url($this->org, '/export?from=2026-11-01&to=2026-11-22'), ['Accept' => 'text/csv'])->assertOk()->streamedContent();
    expect($csv)->toContain('Autre compte')->not->toContain('Camille')->not->toContain($invite->id)->not->toContain('198.51.100')->not->toContain('Chrome');
})->with([
    'invitation locataire' => ['parties.tenant-invitations.accept', 'parties.tenant_access.linked'],
    'invitation mandant' => ['parties.owner-invitations.accept', 'parties.owner_access.linked'],
]);
