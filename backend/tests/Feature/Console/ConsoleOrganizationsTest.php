<?php

declare(strict_types=1);

use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Events\OrganizationCreated;
use App\Modules\Organizations\Models\Organization;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Console\ConsoleContext as C;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Mail::fake();
    config(['notifications.push.driver' => 'fake']);
    $this->admin = C::operateur(['admin'], 'Alice Admin');
    $this->admin2 = C::operateur(['admin'], 'Alain Admin');
    $this->support = C::operateur(['support'], 'Sam Support');
    $this->conformite = C::operateur(['compliance'], 'Clara Conformité');
    $this->billing = C::operateur(['billing'], 'Bill Billing');
    $this->org = T::organisation('Agence du Port');
    $this->titulaire = L::titulaire($this->org);
    $this->gestionnaire = L::membre($this->org, MemberRole::Manager);
    $this->admin_org = L::membre($this->org, MemberRole::Admin);
    $this->suspendre = function (): void {
        $id = C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', [
            'action' => 'organizations.suspend', 'subject_id' => $this->org->id, 'reason' => 'Fraude avérée sur plusieurs encaissements',
            'payload' => ['reason_code' => 'fraud'],
        ])->assertCreated()->json('data.id');
        C::ecrire($this, $this->conformite['jeton'], 'POST', "/api/v1/console/approvals/{$id}/approve")->assertOk();
    };
});

it('émet OrganizationCreated à la création d\'une organisation', function (): void {
    Event::fake([OrganizationCreated::class]);

    $autre = T::organisation('Agence du Nord');

    Event::assertDispatched(OrganizationCreated::class, fn (OrganizationCreated $e): bool => $e->organizationId === $autre->id);
});

it('liste les organisations avec filtres, effectif actif et pagination, sans donnée métier', function (): void {
    $individuelle = Organization::factory()->create(['kind' => OrganizationKind::Individual, 'name' => 'Marie Bailleur']);

    $liste = C::lire($this, $this->support['jeton'], '/api/v1/console/organizations')->assertOk();
    $lignes = collect($liste->json('data'))->keyBy('id');

    expect($lignes->keys()->all())->toEqualCanonicalizing([$this->org->id, $individuelle->id])
        ->and($lignes[$this->org->id])->toMatchArray(['name' => 'Agence du Port', 'kind' => 'agency', 'country' => 'FR', 'state' => 'active', 'suspension' => null, 'members_count' => 3])
        ->and(array_keys($lignes[$this->org->id]))->toEqualCanonicalizing(['id', 'name', 'kind', 'country', 'created_at', 'state', 'suspension', 'members_count', 'plan', 'subscription_status'])
        ->and($lignes[$individuelle->id]['members_count'])->toBe(0);

    C::lire($this, $this->support['jeton'], '/api/v1/console/organizations?kind=individual')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $individuelle->id);
    C::lire($this, $this->support['jeton'], '/api/v1/console/organizations?search=Agen')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $this->org->id);
    C::lire($this, $this->support['jeton'], '/api/v1/console/organizations?search=Ag')->assertUnprocessable();
    C::lire($this, $this->support['jeton'], '/api/v1/console/organizations?search=%25%25%25')->assertOk()->assertJsonCount(0, 'data');
    C::lire($this, $this->support['jeton'], '/api/v1/console/organizations?state=suspended')->assertOk()->assertJsonCount(0, 'data');
    C::lire($this, $this->support['jeton'], '/api/v1/console/organizations?kind=inconnu')->assertUnprocessable();

    $page = C::lire($this, $this->support['jeton'], '/api/v1/console/organizations?per_page=1')->assertOk();
    expect($page->json('data'))->toHaveCount(1)->and($page->json('meta.has_more'))->toBeTrue();
    $suite = C::lire($this, $this->support['jeton'], '/api/v1/console/organizations?per_page=1&cursor='.$page->json('meta.next_cursor'))->assertOk();
    expect($suite->json('data.0.id'))->not->toBe($page->json('data.0.id'))->and($suite->json('meta.has_more'))->toBeFalse();
});

it('sert la fiche : titulaire par prénom, nom et compte, 2FA exigée, audit de consultation', function (): void {
    $reponse = C::lire($this, $this->billing['jeton'], '/api/v1/console/organizations/'.$this->org->id)->assertOk();

    expect($reponse->json('data'))->toMatchArray([
        'id' => $this->org->id,
        'two_factor_required' => false,
        'owner' => ['first_name' => 'Awa', 'last_name' => 'Diallo', 'account_id' => $this->titulaire->id],
        'members_count' => 3,
    ]);
    expect(json_encode($reponse->json()))->not->toContain($this->titulaire->email);
    expect(AuditLog::query()->where('action', 'console.organization.viewed')->where('subject_id', $this->org->id)->exists())->toBeTrue();
    C::lire($this, $this->billing['jeton'], '/api/v1/console/organizations/'.C::UUID_INCONNU)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
});

it('garde les routes organisations : 401, 403 hors espace opérateur, rôle opérateur obligatoire', function (): void {
    foreach (['/api/v1/console/organizations', '/api/v1/console/organizations/'.$this->org->id] as $url) {
        C::reinitialiser($this);
        $this->getJson($url)->assertUnauthorized();

        $mobile = $this->titulaire->createToken('mobile', ['mobile'])->plainTextToken;
        C::reinitialiser($this);
        $this->withToken($mobile)->getJson($url)->assertForbidden();

        $sansRole = C::operateur([], 'Sans rôle');
        C::lire($this, $sansRole['jeton'], $url)->assertForbidden()->assertJsonPath('code', 'operator_role_required');
    }

    T::comme($this, $this->titulaire)->getJson('/api/v1/console/organizations')->assertForbidden();
});

it('suspend une organisation par double validation : écritures 403, lectures 200, titulaire et administrateur prévenus', function (): void {
    ($this->suspendre)();

    expect($this->org->fresh()?->isSuspended())->toBeTrue()
        ->and($this->org->fresh()?->suspension_reason?->value)->toBe('fraud');

    T::comme($this, $this->titulaire)->getJson('/api/v1/org/'.$this->org->id.'/members')->assertOk();
    T::comme($this, $this->titulaire)->postJson('/api/v1/org/'.$this->org->id.'/members', ['email' => 'nouveau@exemple.fr', 'first_name' => 'Jo', 'last_name' => 'Lu', 'role' => 'manager'])
        ->assertForbidden()->assertJsonPath('code', 'organization_suspended');
    T::comme($this, $this->titulaire)->putJson('/api/v1/org/'.$this->org->id.'/security', ['two_factor_required' => true])->assertForbidden()->assertJsonPath('code', 'organization_suspended');

    $liste = C::lire($this, $this->support['jeton'], '/api/v1/console/organizations/'.$this->org->id)->assertOk()->assertJsonPath('data.state', 'suspended')->assertJsonPath('data.suspension.reason', 'fraud');
    expect($liste->json('data.suspension.suspended_at'))->not->toBeNull();

    expect(N::nombre($this->titulaire, NotificationType::OrganizationSuspended))->toBe(1)
        ->and(N::nombre($this->admin_org, NotificationType::OrganizationSuspended))->toBe(1)
        ->and(N::nombre($this->gestionnaire, NotificationType::OrganizationSuspended))->toBe(0);

    $audit = AuditLog::query()->where('action', 'organizations.organization.suspended')->firstOrFail();
    expect($audit->metadata['reason_code'])->toBe('fraud')->and($audit->subject_id)->toBe($this->org->id);
});

it('réactive par double validation et prévient à nouveau', function (): void {
    ($this->suspendre)();

    $id = C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', [
        'action' => 'organizations.reactivate', 'subject_id' => $this->org->id, 'reason' => 'Régularisation constatée avec le titulaire',
    ])->assertCreated()->json('data.id');
    C::ecrire($this, $this->admin['jeton'], 'POST', "/api/v1/console/approvals/{$id}/approve")->assertOk();

    expect($this->org->fresh()?->isSuspended())->toBeFalse()
        ->and($this->org->fresh()?->suspension_reason)->toBeNull()
        ->and(N::nombre($this->titulaire, NotificationType::OrganizationReactivated))->toBe(1);
    T::comme($this, $this->titulaire)->putJson('/api/v1/org/'.$this->org->id.'/security', ['two_factor_required' => true])->assertOk();
});

it('refuse de demander une suspension invalide : motif absent ou impayé, déjà suspendue, inconnue ; réactivation d\'une organisation active', function (): void {
    $corps = fn (array $charge, string $action = 'organizations.suspend', ?string $id = null): array => [
        'action' => $action, 'subject_id' => $id ?? $this->org->id, 'reason' => 'Fraude avérée sur plusieurs encaissements', 'payload' => $charge,
    ];

    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', $corps([]))->assertUnprocessable();
    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', $corps(['reason_code' => 'unpaid']))->assertUnprocessable();
    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', $corps(['reason_code' => 'fraud'], id: C::UUID_INCONNU))->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', $corps([], 'organizations.reactivate'))->assertConflict()->assertJsonPath('code', 'organization_not_suspended');

    ($this->suspendre)();
    C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', $corps(['reason_code' => 'fraud']))->assertConflict()->assertJsonPath('code', 'organization_already_suspended');
});

it('laisse une organisation suspendue répondre aux accès du support', function (): void {
    ($this->suspendre)();
    $nomsAutorises = collect(app('router')->getRoutes()->getRoutes())->map(fn ($r) => (string) $r->getName())->filter(fn (string $n): bool => str_starts_with($n, 'messaging.support_access.'))->all();

    expect($nomsAutorises)->not->toBeEmpty();
    T::comme($this, $this->titulaire)->postJson('/api/v1/org/'.$this->org->id.'/support-access/'.C::UUID_INCONNU.'/refuse')->assertNotFound();
});

it('compte les membres en une requête quel que soit le nombre d\'organisations', function (): void {
    $compter = function (): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        C::lire($this, $this->admin['jeton'], '/api/v1/console/organizations')->assertOk();
        $n = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $n;
    };
    $compter();
    $avant = $compter();
    foreach (range(1, 4) as $i) {
        T::organisation("Agence {$i}");
    }

    expect($compter())->toBe($avant);
});

it('rattache à l\'organisation les audits qui la concernent : le journal ne les divulgue pas sans accès de support', function (): void {
    ($this->suspendre)();
    $id = C::ecrire($this, $this->support['jeton'], 'POST', '/api/v1/console/approvals', [
        'action' => 'organizations.reactivate', 'subject_id' => $this->org->id, 'reason' => 'Régularisation constatée avec le titulaire',
    ])->assertCreated()->json('data.id');
    C::ecrire($this, $this->admin['jeton'], 'POST', "/api/v1/console/approvals/{$id}/approve")->assertOk();
    C::lire($this, $this->support['jeton'], '/api/v1/console/organizations/'.$this->org->id)->assertOk();

    foreach (['organizations.organization.suspended', 'organizations.organization.reactivated', 'console.organization.viewed'] as $action) {
        expect(AuditLog::query()->where('action', $action)->firstOrFail()->organization_id)->toBe($this->org->id, $action);
    }

    $journal = C::lire($this, $this->support['jeton'], '/api/v1/console/activity?organization='.$this->org->id.'&action=organizations.organization.')->assertOk();
    expect($journal->json('data'))->not->toBeEmpty();

    foreach ($journal->json('data') as $entree) {
        expect($entree['metadata'])->toBeNull()->and($entree['changes'])->toBeNull();
    }
});
