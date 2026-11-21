<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Subscriptions\Actions\EndTrials;
use App\Modules\Subscriptions\Actions\StartTrial;
use App\Modules\Subscriptions\Actions\VerifySubscriptions;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Models\OrganizationEntitlementOverride;
use App\Modules\Subscriptions\Models\PlanPrice;
use App\Modules\Subscriptions\Models\PlanVersion;
use App\Modules\Subscriptions\Models\Subscription;
use App\Modules\Subscriptions\PublicApi\Entitlements;
use App\Modules\Subscriptions\Support\PlanGrid;
use App\Shared\Audit\AuditLog;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Feature\Console\ConsoleContext as C;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Mail::fake();
    app(PlanGrid::class)->seed();
    $this->admin = C::operateur(['admin'], 'Alice Admin');
    $this->support = C::operateur(['support'], 'Sam Support');
    $this->conformite = C::operateur(['compliance'], 'Clara Conformité');
    $this->billing = C::operateur(['billing'], 'Bill Billing');
    $this->billing2 = C::operateur(['billing'], 'Béa Billing');
    $this->org = T::organisation('Agence du Port');
    $this->titulaire = L::titulaire($this->org);
    $this->abonnement = fn (): Subscription => AcrossOrganizations::query(Subscription::class)->where('organization_id', $this->org->id)->firstOrFail();
    $this->demander = fn (array $op, string $action, string $sujet, array $charge = []) => C::ecrire($this, $op['jeton'], 'POST', '/api/v1/console/approvals', [
        'action' => $action, 'subject_id' => $sujet, 'reason' => 'Demande commerciale validée avec le client', 'payload' => $charge,
    ]);
    $this->valider = fn (array $op, string $id) => C::ecrire($this, $op['jeton'], 'POST', "/api/v1/console/approvals/{$id}/approve");
    $this->finEssai = function (): void {
        $this->travel(16)->days();
        app(EndTrials::class)->handle();
    };
});

it('charge la grille ADR 0013 : EUR et CAD en centimes, quotas, version publiée', function (): void {
    $liste = C::lire($this, $this->billing['jeton'], '/api/v1/console/plans')->assertOk();
    $plans = collect($liste->json('data'))->keyBy('code');

    expect($plans->keys()->all())->toEqualCanonicalizing(['free', 'silver', 'gold']);
    $silver = collect($plans['silver']['versions'][0]['prices'])->keyBy('currency');
    $gold = collect($plans['gold']['versions'][0]['prices'])->keyBy('currency');
    expect($silver['EUR'])->toMatchArray(['monthly_amount' => 490, 'yearly_amount' => 5800])
        ->and($silver['CAD'])->toMatchArray(['monthly_amount' => 844, 'yearly_amount' => 9340])
        ->and($gold['EUR'])->toMatchArray(['monthly_amount' => 1090, 'yearly_amount' => 11800])
        ->and($gold['CAD'])->toMatchArray(['monthly_amount' => 1804, 'yearly_amount' => 18940])
        ->and($plans['free']['versions'][0])->toMatchArray(['status' => 'published', 'trial_days' => 15, 'version' => 1]);
    $limites = collect($plans['free']['versions'][0]['entitlements'])->keyBy('feature');
    expect($limites['tenants']['limit'])->toBe(2)->and($limites['leases']['limit'])->toBe(2)->and($limites['inspections']['limit'])->toBe(4)
        ->and($limites['storage_mb']['limit'])->toBe(50)->and($limites['users']['limit'])->toBe(1)->and($limites['rent']['kind'])->toBe('function');

    expect(app(PlanGrid::class)->seed())->toBe(0);
    C::lire($this, $this->billing['jeton'], '/api/v1/console/plans/silver')->assertOk()->assertJsonPath('data.name', 'Silver');
    C::lire($this, $this->billing['jeton'], '/api/v1/console/plans/inconnu')->assertNotFound()->assertJsonPath('code', 'plan_not_found');
});

it('ouvre un essai de 15 jours à la création d\'une organisation, en CAD pour le Canada, puis le termine en Gratuit', function (): void {
    $abonnement = ($this->abonnement)();
    expect($abonnement->status->value)->toBe('trialing')
        ->and($abonnement->currency)->toBe('EUR')
        ->and((int) round(now()->diffInDays($abonnement->trial_ends_at, true)))->toBe(15)
        ->and(AuditLog::query()->where('action', 'subscriptions.subscription.created')->count())->toBe(1);

    $canadienne = Organization::factory()->create(['country' => 'CA']);
    app(StartTrial::class)->handle($canadienne->id);
    expect(AcrossOrganizations::query(Subscription::class)->where('organization_id', $canadienne->id)->firstOrFail()->currency)->toBe('CAD');

    expect(app(EndTrials::class)->handle())->toBe(0);
    ($this->finEssai)();
    expect(($this->abonnement)()->status->value)->toBe('free')
        ->and(AuditLog::query()->where('action', 'subscriptions.subscription.trial_ended')->count())->toBeGreaterThanOrEqual(1);
    expect(app(EndTrials::class)->handle())->toBe(0);
});

it('applique les quotas : essai complet, puis Gratuit refuse la création avec 409 et le plan suffisant', function (): void {
    $invitation = ['email' => 'nouveau@exemple.fr', 'first_name' => 'Jo', 'last_name' => 'Lu', 'role' => 'manager', 'scope' => ['type' => 'all']];

    T::comme($this, $this->titulaire)->postJson('/api/v1/org/'.$this->org->id.'/members', $invitation)->assertCreated();

    ($this->finEssai)();
    T::comme($this, $this->titulaire)->postJson('/api/v1/org/'.$this->org->id.'/members', [...$invitation, 'email' => 'autre@exemple.fr'])
        ->assertStatus(409)->assertJsonPath('code', 'plan_quota_reached');
    $detail = T::comme($this, $this->titulaire)->postJson('/api/v1/org/'.$this->org->id.'/members', [...$invitation, 'email' => 'autre@exemple.fr'])->json('detail');
    expect($detail)->toContain('Silver');
    T::comme($this, $this->titulaire)->getJson('/api/v1/org/'.$this->org->id.'/members')->assertOk();
});

it('ne bloque pas une organisation sans abonnement et la rattrape par subscriptions:verify', function (): void {
    $ancienne = Organization::factory()->create();

    app(Entitlements::class)->assertWithin($ancienne->id, Feature::Leases, 999);
    expect(app(Entitlements::class)->effective($ancienne->id))->toBeNull();

    $resultat = app(VerifySubscriptions::class)->handle();
    expect($resultat['missing'])->toBe(1)->and($resultat['created'])->toBe(1)
        ->and(app(Entitlements::class)->effective($ancienne->id))->not->toBeNull()
        ->and(app(VerifySubscriptions::class)->handle()['missing'])->toBe(0);
});

it('refuse une fonction désactivée par dérogation avec 403 feature_not_in_plan', function (): void {
    $droits = app(Entitlements::class);
    ($this->finEssai)();

    $id = ($this->demander)($this->billing, 'subscriptions.override.grant', $this->org->id, [
        'feature' => 'leases', 'enabled' => 'false', 'ends_at' => now()->addDays(30)->toDateString(), 'reason_code' => 'incident',
    ])->assertCreated()->json('data.id');
    ($this->valider)($this->admin, $id)->assertOk();

    $code = null;
    try {
        $droits->assertEnabled($this->org->id, Feature::Leases);
    } catch (ApiProblem $refus) {
        $code = [$refus->problemCode, $refus->status];
    }
    expect($code)->toBe(['feature_not_in_plan', 403]);
});

it('accorde une dérogation de quota par double validation puis la retire', function (): void {
    ($this->finEssai)();
    $fin = now()->addDays(60)->toDateString();

    $id = ($this->demander)($this->billing, 'subscriptions.override.grant', $this->org->id, [
        'feature' => 'users', 'enabled' => 'true', 'limit_value' => '3', 'ends_at' => $fin, 'reason_code' => 'commercial_gesture',
    ])->assertCreated()->json('data.id');
    ($this->valider)($this->billing, $id)->assertForbidden();
    expect(OrganizationEntitlementOverride::query()->withoutGlobalScopes()->count())->toBe(0);
    ($this->valider)($this->billing2, $id)->assertOk();

    $droit = collect(C::lire($this, $this->support['jeton'], '/api/v1/console/organizations/'.$this->org->id.'/entitlements')->assertOk()->json('data.entitlements'))->keyBy('feature');
    expect($droit['users'])->toMatchArray(['limit' => 3, 'source' => 'override', 'enabled' => true]);
    $audit = AuditLog::query()->where('action', 'subscriptions.override.granted')->firstOrFail();
    expect($audit->metadata['approval_id'])->toBe($id)->and(json_encode($audit->metadata))->not->toContain('Demande commerciale');

    $invitation = ['email' => 'a@exemple.fr', 'first_name' => 'A', 'last_name' => 'B', 'role' => 'manager', 'scope' => ['type' => 'all']];
    T::comme($this, $this->titulaire)->postJson('/api/v1/org/'.$this->org->id.'/members', $invitation)->assertCreated();

    $derogation = OrganizationEntitlementOverride::query()->withoutGlobalScopes()->firstOrFail();
    $retrait = ($this->demander)($this->billing, 'subscriptions.override.revoke', $derogation->id)->assertCreated()->json('data.id');
    ($this->valider)($this->admin, $retrait)->assertOk();
    expect($derogation->fresh()?->revoked_at)->not->toBeNull()
        ->and(collect(C::lire($this, $this->admin['jeton'], '/api/v1/console/organizations/'.$this->org->id.'/entitlements')->json('data.entitlements'))->keyBy('feature')['users']['source'])->toBe('plan');
    ($this->demander)($this->billing, 'subscriptions.override.revoke', $derogation->id)->assertUnprocessable()->assertJsonPath('code', 'override_invalid');
});

it('refuse une dérogation invalide : sans fin, trop longue, quota sur une fonction, organisation sans abonnement', function (): void {
    $valide = ['feature' => 'users', 'enabled' => 'true', 'limit_value' => '3', 'ends_at' => now()->addDays(30)->toDateString(), 'reason_code' => 'pilot'];
    $essai = fn (array $charge, ?string $sujet = null) => ($this->demander)($this->billing, 'subscriptions.override.grant', $sujet ?? $this->org->id, $charge);

    $essai($valide)->assertCreated();
    $autre = fn (array $surcharge) => ($this->demander)($this->billing, 'subscriptions.override.grant', $this->org->id, [...$valide, ...$surcharge]);

    foreach ([['ends_at' => ''], ['ends_at' => now()->addDays(400)->toDateString()], ['ends_at' => now()->subDay()->toDateString()], ['feature' => 'rent', 'limit_value' => '3'], ['reason_code' => 'libre'], ['feature' => 'inconnue']] as $surcharge) {
        $autre($surcharge)->assertUnprocessable();
    }
    $essai($valide, Organization::factory()->create()->id)->assertUnprocessable()->assertJsonPath('code', 'override_invalid');
});

it('crée, modifie et publie une version de plan : brouillon unique, figée ensuite, ancienne archivée, abonnements inchangés', function (): void {
    $silverV1 = PlanVersion::query()->whereHas('plan', fn ($q) => $q->where('code', 'silver'))->firstOrFail();

    $brouillon = C::ecrire($this, $this->billing['jeton'], 'POST', '/api/v1/console/plans/silver/versions')->assertCreated()
        ->assertJsonPath('data.version', 2)->assertJsonPath('data.status', 'draft');
    $id = $brouillon->json('data.id');
    expect($brouillon->json('data.prices'))->toHaveCount(2)->and($brouillon->json('data.entitlements'))->toHaveCount(count(Feature::cases()));
    C::ecrire($this, $this->billing['jeton'], 'POST', '/api/v1/console/plans/silver/versions')->assertConflict()->assertJsonPath('code', 'plan_draft_exists');

    $maj = C::ecrire($this, $this->billing['jeton'], 'PATCH', "/api/v1/console/plan-versions/{$id}", [
        'prices' => [['currency' => 'EUR', 'monthly_amount' => 590, 'yearly_amount' => 6400]],
        'entitlements' => [['feature' => 'properties', 'enabled' => true, 'limit_value' => 8]],
    ])->assertOk();
    expect(collect($maj->json('data.prices'))->firstWhere('currency', 'EUR'))->toMatchArray(['monthly_amount' => 590])
        ->and(collect($maj->json('data.entitlements'))->firstWhere('feature', 'properties')['limit'])->toBe(8);
    C::ecrire($this, $this->billing['jeton'], 'PATCH', "/api/v1/console/plan-versions/{$id}", ['trial_days' => 30, 'status' => 'published'])->assertOk();
    expect(PlanVersion::query()->findOrFail($id)->trial_days)->toBe(15)->and(PlanVersion::query()->findOrFail($id)->status->value)->toBe('draft');

    $demande = ($this->demander)($this->billing, 'subscriptions.plan_version.publish', $id)->assertCreated()->json('data.id');
    ($this->valider)($this->billing2, $demande)->assertOk();

    expect(PlanVersion::query()->findOrFail($id)->status->value)->toBe('published')
        ->and($silverV1->fresh()?->status->value)->toBe('archived')
        ->and(AuditLog::query()->whereIn('action', ['subscriptions.plan_version.published', 'subscriptions.plan_version.archived'])->count())->toBe(2);
    C::ecrire($this, $this->billing['jeton'], 'PATCH', "/api/v1/console/plan-versions/{$id}", ['public_signup' => false])->assertConflict()->assertJsonPath('code', 'plan_version_not_editable');
});

it('refuse toute modification d\'une version dont la publication est en attente, puis la rouvre après annulation', function (): void {
    $id = C::ecrire($this, $this->billing['jeton'], 'POST', '/api/v1/console/plans/silver/versions')->assertCreated()->json('data.id');
    $demande = ($this->demander)($this->billing, 'subscriptions.plan_version.publish', $id)->assertCreated();
    $avant = PlanPrice::query()->where('plan_version_id', $id)->where('currency', 'EUR')->firstOrFail()->monthly_amount;

    C::ecrire($this, $this->billing['jeton'], 'PATCH', "/api/v1/console/plan-versions/{$id}", ['prices' => [['currency' => 'EUR', 'monthly_amount' => 0, 'yearly_amount' => 0]]])
        ->assertConflict()->assertJsonPath('code', 'plan_version_publication_pending');
    C::ecrire($this, $this->billing2['jeton'], 'PATCH', "/api/v1/console/plan-versions/{$id}", ['public_signup' => false])->assertConflict()->assertJsonPath('code', 'plan_version_publication_pending');
    expect(PlanPrice::query()->where('plan_version_id', $id)->where('currency', 'EUR')->firstOrFail()->monthly_amount)->toBe($avant);

    C::ecrire($this, $this->billing['jeton'], 'POST', '/api/v1/console/approvals/'.$demande->json('data.id').'/cancel')->assertOk();
    C::ecrire($this, $this->billing['jeton'], 'PATCH', "/api/v1/console/plan-versions/{$id}", ['public_signup' => false])->assertOk();
});

it('ne publie rien quand le contenu change entre la demande et la validation : demande en échec, version toujours en brouillon', function (): void {
    $id = C::ecrire($this, $this->billing['jeton'], 'POST', '/api/v1/console/plans/silver/versions')->assertCreated()->json('data.id');
    $demande = ($this->demander)($this->billing, 'subscriptions.plan_version.publish', $id)->assertCreated();

    expect($demande->json('data.payload.content_sha256'))->toMatch('/^[0-9a-f]{64}$/');

    DB::table('plan_prices')->where('plan_version_id', $id)->update(['monthly_amount' => 0, 'yearly_amount' => 0]);
    DB::table('plan_entitlements')->where('plan_version_id', $id)->where('feature_key', 'properties')->update(['limit_value' => null]);

    ($this->valider)($this->billing2, $demande->json('data.id'))->assertConflict()->assertJsonPath('code', 'approval_stale');

    expect(PlanVersion::query()->findOrFail($id)->status->value)->toBe('draft')
        ->and(AuditLog::query()->where('action', 'subscriptions.plan_version.published')->count())->toBe(0)
        ->and(C::lire($this, $this->billing['jeton'], '/api/v1/console/approvals/'.$demande->json('data.id'))->json('data.status'))->toBe('failed');
});

it('journalise avant et après chaque modification de version, sans donnée personnelle', function (): void {
    $id = C::ecrire($this, $this->billing['jeton'], 'POST', '/api/v1/console/plans/silver/versions')->assertCreated()->json('data.id');

    C::ecrire($this, $this->billing['jeton'], 'PATCH', "/api/v1/console/plan-versions/{$id}", [
        'prices' => [['currency' => 'EUR', 'monthly_amount' => 777, 'yearly_amount' => 7000]],
        'entitlements' => [['feature' => 'properties', 'enabled' => true, 'limit_value' => 9]],
    ])->assertOk();

    $metadonnees = AuditLog::query()->where('action', 'subscriptions.plan_version.updated')->latest('id')->firstOrFail()->metadata;

    expect($metadonnees['before']['prices']['EUR']['monthly'])->not->toBe(777)
        ->and($metadonnees['after']['prices']['EUR'])->toBe(['monthly' => 777, 'yearly' => 7000])
        ->and($metadonnees['after']['entitlements']['properties'])->toBe(['enabled' => true, 'limit' => 9])
        ->and(json_encode($metadonnees))->not->toContain($this->billing['user']->email);
});

it('refuse de publier une version sans le socle ou sans prix, et de demander la publication d\'une version figée', function (): void {
    $id = C::ecrire($this, $this->billing['jeton'], 'POST', '/api/v1/console/plans/gold/versions')->assertCreated()->json('data.id');
    C::ecrire($this, $this->billing['jeton'], 'PATCH', "/api/v1/console/plan-versions/{$id}", ['entitlements' => [['feature' => 'rent', 'enabled' => false]]])->assertOk();
    ($this->demander)($this->billing, 'subscriptions.plan_version.publish', $id)->assertUnprocessable()->assertJsonPath('code', 'plan_version_invalid');

    $publiee = PlanVersion::query()->whereHas('plan', fn ($q) => $q->where('code', 'gold'))->where('status', 'published')->firstOrFail();
    ($this->demander)($this->billing, 'subscriptions.plan_version.publish', $publiee->id)->assertConflict()->assertJsonPath('code', 'plan_version_not_editable');
});

it('verrouille en base une version publiée, ses prix et ses droits', function (): void {
    $version = PlanVersion::query()->whereHas('plan', fn ($q) => $q->where('code', 'silver'))->firstOrFail();
    $prix = PlanPrice::query()->where('plan_version_id', $version->id)->firstOrFail();

    foreach ([
        fn () => DB::table('plan_prices')->where('id', $prix->id)->update(['monthly_amount' => 1]),
        fn () => DB::table('plan_prices')->where('id', $prix->id)->delete(),
        fn () => DB::table('plan_entitlements')->where('plan_version_id', $version->id)->update(['enabled' => false]),
        fn () => DB::table('plan_versions')->where('id', $version->id)->update(['trial_days' => 1]),
        fn () => DB::table('plan_versions')->where('id', $version->id)->update(['status' => 'draft']),
        fn () => DB::table('plan_versions')->where('id', $version->id)->delete(),
        fn () => DB::table('plan_prices')->insert(['id' => (string) Str::uuid7(), 'plan_version_id' => $version->id, 'currency' => 'EUR', 'monthly_amount' => 1, 'yearly_amount' => 1, 'created_at' => now(), 'updated_at' => now()]),
    ] as $ecriture) {
        expect($ecriture)->toThrow(QueryException::class);
    }
});

it('interdit de déplacer un prix ou un droit vers une version publiée en changeant son plan_version_id', function (): void {
    $publiee = PlanVersion::query()->whereHas('plan', fn ($q) => $q->where('code', 'silver'))->where('status', 'published')->firstOrFail();
    $id = C::ecrire($this, $this->billing['jeton'], 'POST', '/api/v1/console/plans/gold/versions')->assertCreated()->json('data.id');
    $prix = PlanPrice::query()->where('plan_version_id', $id)->where('currency', 'EUR')->firstOrFail();
    $droit = DB::table('plan_entitlements')->where('plan_version_id', $id)->where('feature_key', 'properties')->first();

    expect(fn () => DB::table('plan_prices')->where('id', $prix->id)->update(['plan_version_id' => $publiee->id]))->toThrow(QueryException::class, 'plan_prices : version figee')
        ->and(fn () => DB::table('plan_entitlements')->where('id', $droit->id)->update(['plan_version_id' => $publiee->id]))->toThrow(QueryException::class, 'plan_entitlements : version figee')
        ->and(PlanPrice::query()->findOrFail($prix->id)->plan_version_id)->toBe($id);
});

it('liste les abonnements avec filtres et sans MRR tant qu\'aucun encaissement n\'existe', function (): void {
    $autre = T::organisation('Agence du Nord');
    ($this->finEssai)();

    $liste = C::lire($this, $this->billing['jeton'], '/api/v1/console/subscriptions')->assertOk();
    expect($liste->json('data'))->toHaveCount(2)->and($liste->json('meta.mrr'))->toBeNull()->and($liste->json('meta.arr'))->toBeNull()
        ->and(array_keys($liste->json('data.0')))->toEqualCanonicalizing(['id', 'organization_id', 'plan', 'plan_version', 'status', 'currency', 'trial_ends_at', 'current_period_end', 'created_at']);
    C::lire($this, $this->billing['jeton'], '/api/v1/console/subscriptions?status=free&plan=free')->assertOk()->assertJsonCount(2, 'data');
    C::lire($this, $this->billing['jeton'], '/api/v1/console/subscriptions?status=active')->assertOk()->assertJsonCount(0, 'data');
    C::lire($this, $this->billing['jeton'], '/api/v1/console/subscriptions?status=nimporte')->assertUnprocessable();
    C::lire($this, $this->billing['jeton'], '/api/v1/console/subscriptions?per_page=1')->assertOk()->assertJsonPath('meta.has_more', true);
    expect($autre->id)->not->toBe($this->org->id);
});

it('expose plan et statut d\'abonnement dans la liste des organisations, avec filtres', function (): void {
    ($this->finEssai)();
    $autre = T::organisation('Agence du Nord');

    $liste = C::lire($this, $this->support['jeton'], '/api/v1/console/organizations')->assertOk();
    $lignes = collect($liste->json('data'))->keyBy('id');
    expect($lignes[$this->org->id])->toMatchArray(['plan' => 'free', 'subscription_status' => 'free'])
        ->and($lignes[$autre->id])->toMatchArray(['plan' => 'free', 'subscription_status' => 'trialing']);

    C::lire($this, $this->support['jeton'], '/api/v1/console/organizations?subscription_status=trialing')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $autre->id);
    C::lire($this, $this->support['jeton'], '/api/v1/console/organizations?plan=gold')->assertOk()->assertJsonCount(0, 'data');
    C::lire($this, $this->support['jeton'], '/api/v1/console/organizations/'.$autre->id)->assertOk()->assertJsonPath('data.subscription_status', 'trialing');
});

it('garde les routes Subscriptions : 401, jeton hors opérateur, rôle par route', function (): void {
    $routes = [
        ['GET', '/api/v1/console/plans', ['admin', 'billing']],
        ['GET', '/api/v1/console/plans/silver', ['admin', 'billing']],
        ['GET', '/api/v1/console/subscriptions', ['admin', 'billing']],
        ['GET', '/api/v1/console/organizations/'.$this->org->id.'/entitlements', ['admin', 'support', 'compliance', 'billing']],
        ['POST', '/api/v1/console/plans/silver/versions', ['billing']],
        ['PATCH', '/api/v1/console/plan-versions/'.C::UUID_INCONNU, ['billing']],
    ];
    $operateurs = ['admin' => $this->admin, 'support' => $this->support, 'compliance' => $this->conformite, 'billing' => $this->billing];
    $mobile = $this->titulaire->createToken('mobile', ['mobile'])->plainTextToken;

    foreach ($routes as [$methode, $url, $autorises]) {
        C::reinitialiser($this);
        $this->json($methode, $url)->assertUnauthorized();
        C::reinitialiser($this);
        $this->withToken($mobile)->json($methode, $url)->assertForbidden();
        $sansRole = C::operateur([], 'Sans rôle');
        C::ecrire($this, $sansRole['jeton'], $methode, $url)->assertForbidden()->assertJsonPath('code', 'operator_role_required');

        foreach ($operateurs as $role => $op) {
            if (! in_array($role, $autorises, true)) {
                C::ecrire($this, $op['jeton'], $methode, $url)->assertForbidden()->assertJsonPath('code', 'operator_role_required');
            }
        }
    }

    C::ecrireBrut($this, $this->billing['jeton'], 'POST', '/api/v1/console/plans/silver/versions')->assertUnprocessable()->assertJsonPath('code', 'operator_proof_required');
    C::lire($this, $this->admin['jeton'], '/api/v1/console/organizations/'.C::UUID_INCONNU.'/entitlements')->assertNotFound()->assertJsonPath('code', 'subscription_not_found');
});

it('refuse les demandes de dérogation et de publication à qui n\'a pas le rôle demandeur', function (): void {
    $corps = ['feature' => 'users', 'enabled' => 'true', 'limit_value' => '3', 'ends_at' => now()->addDays(30)->toDateString(), 'reason_code' => 'pilot'];

    ($this->demander)($this->support, 'subscriptions.override.grant', $this->org->id, $corps)->assertForbidden();
    ($this->demander)($this->conformite, 'subscriptions.plan_version.publish', C::UUID_INCONNU)->assertForbidden();
    expect(User::query()->count())->toBeGreaterThan(0);
});
