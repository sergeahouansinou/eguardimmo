<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Models\ApprovalEvidence;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Mandates\Models\Mandate;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReportingContext as X;
use Tests\Feature\Owner\OwnerWriteContext as W;

beforeEach(function (): void {
    ['scene' => $this->scene, 'awa' => $this->awa] = W::agence($this);
    $this->org = $this->scene['org'];
    [$this->id, $this->devis, $this->demande] = W::demande($this, $this->scene);
    $this->vue = W::vue($this, $this->awa, $this->id);
    $this->corps = ['decision' => 'accept', ...$this->vue];
    $this->url = fn (?string $i = null, ?string $a = null): string => '/api/v1/owner/interventions/'.($i ?? $this->id).'/approvals/'.($a ?? $this->demande).'/decision';
    $this->poster = fn (?User $compte, ?string $i = null, ?string $a = null, bool $preuve = true) => (function () use ($compte, $i, $a, $preuve) {
        if ($preuve) {
            O::preuve($this);
        }

        return O::comme($this, $compte)->postJson(($this->url)($i, $a), $this->corps, [...O::ORIGINE, 'Idempotency-Key' => 'securite-cle-1']);
    })();
    $this->intacte = fn () => expect(InterventionApproval::query()->withoutGlobalScopes()->findOrFail($this->demande)->status->value)->toBe('pending')
        ->and(ApprovalEvidence::query()->withoutGlobalScopes()->count())->toBe(0);
});

it('401 sans session', function (): void {
    ($this->poster)(null)->assertUnauthorized();
    ($this->intacte)();
});

it('403 sans profil propriétaire : compte quelconque, locataire, agent de l\'agence', function (): void {
    $locataire = $this->scene['tenant'];

    foreach ([User::factory()->create(), $locataire, $this->scene['owner']] as $compte) {
        activerDeuxFacteurs($compte);
        ($this->poster)($compte)->assertForbidden()->assertJsonPath('code', 'space_forbidden');
    }

    ($this->intacte)();
});

it('403 two_factor_required sans 2FA confirmée', function (): void {
    $this->awa->forceFill(['two_factor_confirmed_at' => null, 'two_factor_secret' => null])->save();
    ($this->poster)($this->awa->refresh())->assertForbidden()->assertJsonPath('code', 'two_factor_required');
    ($this->intacte)();
});

it('403 reauthentication_required sans preuve 2FA récente : absente, échue, mot de passe seul, sans méthode', function (): void {
    ($this->poster)($this->awa, preuve: false)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    O::preuve($this);
    $this->travelTo(now()->addMinutes(11));
    ($this->poster)($this->awa, preuve: false)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    $this->travelTo(now()->subMinutes(11));

    $this->flushSession();
    $this->withSession([EnsureRecentReauthentication::CLE_MOT_DE_PASSE => now()->getTimestamp()]);
    ($this->poster)($this->awa, preuve: false)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    $this->flushSession();
    $this->withSession([EnsureRecentReauthentication::CLE_2FA => now()->getTimestamp()]);
    ($this->poster)($this->awa, preuve: false)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    ($this->intacte)();
});

it('un jeton mobile ne peut pas écrire : 403 reauthentication_required', function (): void {
    O::comme($this, null);
    $jeton = $this->awa->createToken('mobile')->plainTextToken;
    $this->flushSession();

    $this->withToken($jeton)->postJson(($this->url)(), $this->corps, ['Idempotency-Key' => 'securite-cle-1'])->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    ($this->intacte)();
});

it('retient la méthode de la preuve : code de secours', function (): void {
    O::preuve($this, EnsureRecentReauthentication::METHODE_SECOURS);
    O::comme($this, $this->awa)->postJson(($this->url)(), $this->corps, [...O::ORIGINE, 'Idempotency-Key' => 'securite-cle-1'])->assertOk();

    expect(ApprovalEvidence::query()->withoutGlobalScopes()->sole()->proof_method->value)->toBe('recovery_code');
});

it('403 owner_role_forbidden pour un co-indivisaire, sans rien écrire', function (): void {
    $co = User::factory()->create(['email' => 'co@exemple.fr']);
    activerDeuxFacteurs($co);
    O::acces($this->org, $this->scene['mandant'], $co, OwnerAccessRole::CoOwner);

    ($this->poster)($co)->assertForbidden()->assertJsonPath('code', 'owner_role_forbidden');
    ($this->intacte)();
});

it('le représentant d\'une société décide comme le titulaire', function (): void {
    $representant = User::factory()->create(['email' => 'rep@exemple.fr']);
    activerDeuxFacteurs($representant);
    O::acces($this->org, $this->scene['mandant'], $representant, OwnerAccessRole::Representative);

    ($this->poster)($representant)->assertOk()->assertJsonPath('data.status', 'accepted');
    expect(ApprovalEvidence::query()->withoutGlobalScopes()->sole()->user_id)->toBe($representant->id);
});

it('403 owner_access_read_only pendant la grâce, 404 une fois la fenêtre close', function (): void {
    L::dans($this->org, fn () => Mandate::query()->update(['status' => 'terminated', 'ends_on' => '2026-01-01']));

    ($this->poster)($this->awa)->assertForbidden()->assertJsonPath('code', 'owner_access_read_only');
    ($this->intacte)();

    $this->travelTo(now()->addYears(2));
    ($this->poster)($this->awa)->assertNotFound()->assertJsonPath('code', 'owner_intervention_not_found');
});

it('refuse un accès révoqué dès la requête suivante', function (): void {
    DB::table('owner_accesses')->update(['status' => 'revoked', 'revoked_at' => now(), 'revoked_by' => 'organization']);

    ($this->poster)($this->awa)->assertForbidden()->assertJsonPath('code', 'space_forbidden');
    ($this->intacte)();
});

it('cloisonne par (organisation, mandant) : un autre mandant de la même agence, ou un mandant homonyme ailleurs, ne décide pas', function (): void {
    $autreMandant = O::mandant($this->org, 'bob@exemple.fr');
    O::mandat($this->org, $autreMandant);
    $bob = X::rattacher($this->org, $autreMandant, 'bob@exemple.fr');
    activerDeuxFacteurs($bob);

    $ailleurs = L::organisation();
    $ailleursMandant = O::mandant($ailleurs, 'clone@exemple.fr');
    O::mandat($ailleurs, $ailleursMandant);
    $clone = X::rattacher($ailleurs, $ailleursMandant, 'clone@exemple.fr');
    activerDeuxFacteurs($clone);

    foreach ([$bob, $clone] as $intrus) {
        ($this->poster)($intrus)->assertNotFound()->assertJsonPath('code', 'owner_intervention_not_found');
    }

    ($this->intacte)();
});

it('404 sur une demande inconnue, d\'une autre intervention, ou un identifiant mal formé', function (): void {
    [$autreId, , $autreDemande] = W::demande($this, $this->scene, 70000);

    ($this->poster)($this->awa, null, fake()->uuid())->assertNotFound()->assertJsonPath('code', 'intervention_approval_not_found');
    ($this->poster)($this->awa, null, $autreDemande)->assertNotFound()->assertJsonPath('code', 'intervention_approval_not_found');
    ($this->poster)($this->awa, fake()->uuid())->assertNotFound()->assertJsonPath('code', 'owner_intervention_not_found');
    ($this->poster)($this->awa, 'pas-un-uuid')->assertNotFound();
    ($this->poster)($this->awa, null, 'pas-un-uuid')->assertNotFound();
    expect($autreId)->not->toBe($this->id);
    ($this->intacte)();
});

it('refuse une intervention masquée du mandant (non qualifiée) comme inconnue', function (): void {
    DB::table('interventions')->where('id', $this->id)->update(['status' => 'declined']);

    ($this->poster)($this->awa)->assertNotFound()->assertJsonPath('code', 'owner_intervention_not_found');
});

it('refuse un jeton opérateur et une adresse non vérifiée', function (): void {
    $operateur = User::factory()->create();
    $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    activerDeuxFacteurs($operateur);
    O::comme($this, null);
    $this->withToken($operateur->createToken('console', ['operator'])->plainTextToken)->postJson(($this->url)(), $this->corps)->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');

    $this->awa->forceFill(['email_verified_at' => null])->save();
    ($this->poster)($this->awa->refresh())->assertForbidden()->assertJsonPath('code', 'email_unverified');
    ($this->intacte)();
});

it('coupe la décision au-delà de 10 requêtes par minute', function (): void {
    $statuts = [];

    foreach (range(1, 11) as $i) {
        $statuts[] = ($this->poster)($this->awa)->status();
    }

    expect($statuts[10])->toBe(429);
});

it('ne répond ni trace ni chemin interne sur une erreur', function (): void {
    $texte = ($this->poster)($this->awa, fake()->uuid())->getContent();

    foreach (['vendor/', 'app/Modules', 'Stack trace', 'SQLSTATE', 'Illuminate\\'] as $interdit) {
        expect($texte)->not->toContain($interdit);
    }
});

it('protège la route : middlewares, nom et limite dédiée', function (): void {
    $route = Route::getRoutes()->getByName('maintenance.owner.approvals.decide');

    expect($route->gatherMiddleware())->toContain('auth:sanctum', 'no-operator-token', 'space:owner', 'verified', 'throttle:10,1,owner-decision', 'two-factor', 'reauthenticated:two-factor')
        ->and($route->methods())->toBe(['POST']);
});
