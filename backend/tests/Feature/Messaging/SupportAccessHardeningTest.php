<?php

declare(strict_types=1);

use App\Modules\Messaging\Events\SupportAccessUsed;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Routing\Events\PreparingResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\SupportAccessContext as A;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Notification::fake();
    L::semer();
    $this->travelTo(CarbonImmutable::parse(A::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->op = A::operateur();
    O::navigateurAgence($this);
    $this->ticket = A::demande($this, $this->titulaire, $this->org);
    $this->demander = fn (array $corps = []) => A::demanderAcces($this, $this->op['jeton'], $this->ticket, $corps);
    $this->decider = function (string $id, string $action, array $corps = []) {
        O::preuve($this);

        return A::organisation($this, $this->org, $this->titulaire, "/{$id}/{$action}", 'POST', $corps);
    };
    $this->lire = fn (string $ressource) => A::console($this, $this->op['jeton'], $this->org->id, $ressource);
});

it('refuse d\'accepter ou de refuser une demande de plus de 7 jours même si la tâche planifiée est arrêtée', function (): void {
    $id = ($this->demander)()->assertCreated()->json('data.id');
    $autre = A::demande($this, $this->titulaire, $this->org);
    $second = A::demanderAcces($this, $this->op['jeton'], $autre)->assertCreated()->json('data.id');

    $this->travelTo(now()->addDays(7)->subMinute());
    ($this->decider)($second, 'refuse')->assertOk();

    $this->travelTo(CarbonImmutable::parse(A::AUJOURDHUI)->addDays(7));
    ($this->decider)($id, 'accept')->assertConflict()->assertJsonPath('code', 'support_access_not_pending');
    ($this->decider)($id, 'refuse')->assertConflict()->assertJsonPath('code', 'support_access_not_pending');
    ($this->lire)('team')->assertForbidden();

    expect(A::grant($id)->status->value)->toBe('requested')->and(AuditLog::query()->where('action', 'messaging.support_access.granted')->count())->toBe(0);
});

it('accepte une demande de moins de 7 jours sans tâche planifiée', function (): void {
    $id = ($this->demander)()->assertCreated()->json('data.id');
    $this->travelTo(now()->addDays(6));

    ($this->decider)($id, 'accept')->assertOk()->assertJsonPath('data.status', 'active');
});

it('refuse un périmètre vide à l\'acceptation, sans jamais élargir l\'accès', function (array $corps, string $champ): void {
    $id = ($this->demander)(['scopes' => ['settings']])->assertCreated()->json('data.id');

    ($this->decider)($id, 'accept', $corps)->assertUnprocessable()->assertJsonValidationErrors($champ);

    expect(A::grant($id)->status->value)->toBe('requested')->and(A::grant($id)->scopes)->toBe(['settings']);
    ($this->lire)('settings')->assertForbidden();
})->with([
    'liste vide' => [['scopes' => []], 'scopes'],
    'valeur inconnue' => [['scopes' => ['conversations']], 'scopes.0'],
    'valeur vide' => [['scopes' => ['']], 'scopes.0'],
]);

it('garde le périmètre demandé quand l\'acceptation n\'en précise aucun', function (): void {
    $id = ($this->demander)(['scopes' => ['team']])->assertCreated()->json('data.id');

    ($this->decider)($id, 'accept')->assertOk()->assertJsonPath('data.scopes', ['team']);
});

it('ne sert rien d\'un ancien accès enregistré avant le consentement', function (array $surcharges): void {
    $maintenant = now()->format('Y-m-d H:i:s.u');
    DB::table('support_access_grants')->insert([
        'id' => (string) Str::uuid7(), 'support_ticket_id' => $this->ticket, 'operator_user_id' => $this->op['user']->id,
        'reason' => 'Ancien accès décidé par l\'opérateur seul', 'granted_at' => $maintenant, 'expires_at' => now()->addDays(3)->format('Y-m-d H:i:s.u'),
        'created_at' => $maintenant, 'updated_at' => $maintenant,
        'organization_id' => null, 'kind' => 'consent', 'scopes' => '[]', 'status' => 'expired', 'duration_hours' => 0, 'requested_at' => $maintenant, 'read_count' => 0,
        ...$surcharges,
    ]);

    foreach (['team', 'settings'] as $ressource) {
        ($this->lire)($ressource)->assertForbidden()->assertJsonPath('code', 'support_access_required');
    }
    A::organisation($this, $this->org, $this->titulaire)->assertOk()->assertJsonCount(0, 'data');
})->with([
    'forme laissée par la migration' => [[]],
    'même éteint à tort actif, sans organisation ni périmètre' => [['status' => 'active', 'scopes' => null]],
    'actif avec le périmètre mais sans organisation' => [['status' => 'active', 'scopes' => '["team","settings"]']],
]);

it('refuse la lecture quand l\'accès est révoqué entre le garde et l\'enregistrement de la lecture', function (): void {
    Event::fake([SupportAccessUsed::class]);
    $id = A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire);
    $revoque = false;
    Event::listen(PreparingResponse::class, function () use ($id, &$revoque): void {
        if (! $revoque) {
            $revoque = true;
            SupportAccessGrant::query()->whereKey($id)->update(['status' => 'revoked']);
        }
    });

    ($this->lire)('team')->assertForbidden()->assertJsonPath('code', 'support_access_required');

    expect($revoque)->toBeTrue()->and(A::grant($id)->read_count)->toBe(0)->and(AuditLog::query()->where('action', 'console.support_access.read')->count())->toBe(0);
    Event::assertNotDispatched(SupportAccessUsed::class);
});
