<?php

declare(strict_types=1);

use App\Modules\Messaging\Enums\SupportAccessKind;
use App\Modules\Messaging\Models\SupportAccessGrant;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
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
    $this->second = A::operateur('Paul Durand');
    O::navigateurAgence($this);
    $this->ticket = A::demande($this, $this->titulaire, $this->org);
    $this->revue = function (array $relecteur, string $acces) {
        A::jeton($this);

        return $this->withToken($relecteur['jeton'])->postJson("/api/v1/console/support/access/{$acces}/review", avecPreuve($relecteur['jeton']));
    };
    $this->revoquer = function (string $acces) {
        O::preuve($this);

        return A::organisation($this, $this->org, $this->titulaire, "/{$acces}/revoke", 'POST');
    };
});

it('fixe le délai après révocation à 24 h par défaut, configurable par SUPPORT_EMERGENCY_COOLDOWN_HOURS', function (): void {
    expect(config('messaging.support.emergency_cooldown_hours'))->toBe(24)
        ->and((string) file_get_contents(base_path('.env.example')))->toContain('SUPPORT_EMERGENCY_COOLDOWN_HOURS=24');
});

it('refuse une nouvelle urgence du même opérateur sur l\'organisation tant que la précédente n\'est pas revue', function (): void {
    $premier = A::urgence($this, $this->op['jeton'], $this->ticket)->assertCreated()->json('data.id');
    $this->travelTo(now()->addHours(2));

    A::urgence($this, $this->op['jeton'], $this->ticket)->assertConflict()->assertJsonPath('code', 'support_emergency_review_pending');
    A::urgence($this, $this->second['jeton'], $this->ticket)->assertCreated();
    expect(SupportAccessGrant::query()->where('kind', SupportAccessKind::Emergency)->count())->toBe(2);

    $this->travelTo(now()->addHours(2));
    ($this->revue)($this->second, $premier)->assertOk();
    A::urgence($this, $this->op['jeton'], $this->ticket)->assertCreated();
});

it('rouvre une urgence après expiration une fois la précédente revue', function (): void {
    $premier = A::urgence($this, $this->op['jeton'], $this->ticket)->assertCreated()->json('data.id');
    ($this->revue)($this->second, $premier)->assertOk();
    $this->travelTo(now()->addMinutes(61));
    A::console($this, $this->op['jeton'], $this->org->id, 'team')->assertForbidden();

    A::urgence($this, $this->op['jeton'], $this->ticket)->assertCreated()->assertJsonPath('data.status', 'active');
    A::console($this, $this->op['jeton'], $this->org->id, 'team')->assertOk();
});

it('ne laisse qu\'une urgence vivante par organisation, quelle que soit la demande ou l\'opérateur', function (): void {
    A::urgence($this, $this->op['jeton'], $this->ticket)->assertCreated();
    $autre = A::demande($this, $this->titulaire, $this->org);

    A::urgence($this, $this->second['jeton'], $autre)->assertConflict()->assertJsonPath('code', 'support_emergency_organization_busy');
    A::urgence($this, $this->op['jeton'], $autre)->assertConflict()->assertJsonPath('code', 'support_emergency_organization_busy');

    $this->travelTo(now()->addMinutes(61));
    A::urgence($this, $this->second['jeton'], $autre)->assertCreated();
});

it('refuse toute urgence pendant le délai qui suit une révocation par l\'organisation, puis la rouvre', function (): void {
    $id = A::urgence($this, $this->op['jeton'], $this->ticket)->assertCreated()->json('data.id');
    ($this->revue)($this->second, $id)->assertOk();
    ($this->revoquer)($id)->assertOk()->assertJsonPath('data.status', 'revoked');

    $refus = A::urgence($this, $this->second['jeton'], $this->ticket)->assertStatus(429)->assertJsonPath('code', 'support_emergency_cooldown');
    expect((int) $refus->headers->get('Retry-After'))->toBe(24 * 3600);
    A::urgence($this, $this->op['jeton'], $this->ticket)->assertStatus(429)->assertJsonPath('code', 'support_emergency_cooldown');

    $this->travelTo(now()->addHours(23));
    A::urgence($this, $this->second['jeton'], $this->ticket)->assertStatus(429)->assertJsonPath('code', 'support_emergency_cooldown');

    $this->travelTo(now()->addHours(1)->addMinute());
    A::urgence($this, $this->second['jeton'], $this->ticket)->assertCreated();
});

it('applique le délai configuré et ne le déclenche que par une révocation d\'urgence', function (): void {
    config(['messaging.support.emergency_cooldown_hours' => 2]);
    $consenti = A::accesActif($this, $this->op['jeton'], $this->ticket, $this->org, $this->titulaire);
    ($this->revoquer)($consenti)->assertOk();
    $id = A::urgence($this, $this->op['jeton'], $this->ticket)->assertCreated()->json('data.id');
    ($this->revoquer)($id)->assertOk();

    A::urgence($this, $this->second['jeton'], $this->ticket)->assertStatus(429)->assertJsonPath('code', 'support_emergency_cooldown');
    $this->travelTo(now()->addHours(2)->addMinute());
    A::urgence($this, $this->second['jeton'], $this->ticket)->assertCreated();
});

it('plafonne les urgences à 3 par organisation et par 24 h', function (): void {
    $operateurs = [$this->op, $this->second, A::operateur('Alice Roux'), A::operateur('Marc Petit')];

    foreach (array_slice($operateurs, 0, 3) as $operateur) {
        A::urgence($this, $operateur['jeton'], $this->ticket)->assertCreated();
        $this->travelTo(now()->addMinutes(61));
    }

    $refus = A::urgence($this, $operateurs[3]['jeton'], $this->ticket)->assertStatus(429)->assertJsonPath('code', 'support_emergency_limit');
    expect((int) $refus->headers->get('Retry-After'))->toBe(24 * 3600 - 3 * 61 * 60);

    $this->travelTo(now()->addHours(22));
    A::urgence($this, $operateurs[3]['jeton'], $this->ticket)->assertCreated();
});

it('ne mélange pas les organisations : le plafond, le délai et l\'urgence vivante sont propres à chacune', function (): void {
    A::urgence($this, $this->op['jeton'], $this->ticket)->assertCreated();
    $autre = T::organisation('Agence Rivale');
    $titulaire = L::titulaire($autre);
    $billet = A::demande($this, $titulaire, $autre);

    A::urgence($this, $this->second['jeton'], $billet)->assertCreated();
    A::urgence($this, $this->op['jeton'], $billet)->assertConflict();
});
