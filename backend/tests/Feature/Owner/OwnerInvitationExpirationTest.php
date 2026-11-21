<?php

declare(strict_types=1);

use App\Modules\Identity\Models\OwnerInvitation;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Notification::fake();
    L::semer();
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = L::titulaire($this->org);
    O::navigateurAgence($this);
    O::preuve($this);
    $this->mandant = O::mandant($this->org);
    $this->inviter = function (string $email) {
        O::preuve($this);

        return O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $this->mandant), ['role' => 'holder', 'identity_verified' => true, 'email' => $email])->assertCreated();
    };
});

it('fait expirer les invitations échues, efface leur jeton et leur code et laisse les autres', function (): void {
    ($this->inviter)('ancienne@exemple.fr');
    $this->travelTo(now()->addDays(6));
    ($this->inviter)('recente@exemple.fr');
    $this->travelTo(now()->addDays(2));

    $this->artisan('identity:expire-owner-invitations')->expectsOutput('1 invitation(s) propriétaire expirée(s).')->assertSuccessful();

    $statuts = L::dans($this->org, fn (): array => OwnerInvitation::query()->orderBy('created_at')->get()->map(fn (OwnerInvitation $i): array => [$i->status->value, $i->token_hash, $i->code_hash])->all());
    expect($statuts[0])->toBe(['expired', null, null])->and($statuts[1][0])->toBe('pending')->and($statuts[1][1])->not->toBeNull();
    expect(AuditLog::query()->where('action', 'identity.owner_invitation.expired')->count())->toBe(1);

    $this->artisan('identity:expire-owner-invitations')->expectsOutput('0 invitation(s) propriétaire expirée(s).')->assertSuccessful();
});

it('permet de réinviter la même adresse après l\'expiration', function (): void {
    ($this->inviter)('ancienne@exemple.fr');
    $this->travelTo(now()->addDays(8));
    $this->artisan('identity:expire-owner-invitations')->assertSuccessful();

    ($this->inviter)('ancienne@exemple.fr');
    expect(L::dans($this->org, fn (): int => OwnerInvitation::query()->where('status', 'pending')->count()))->toBe(1);
});

it('planifie la commande quotidienne', function (): void {
    $evenements = collect(app(Schedule::class)->events())->map(fn ($e): string => (string) $e->command);

    expect($evenements->contains(fn (string $c): bool => str_contains($c, 'identity:expire-owner-invitations')))->toBeTrue();
});

it('garantit en base une seule invitation en attente par mandant et par adresse', function (): void {
    ($this->inviter)('unique@exemple.fr');
    $existante = L::dans($this->org, fn (): OwnerInvitation => OwnerInvitation::query()->firstOrFail());

    expect(fn () => L::dans($this->org, fn () => OwnerInvitation::query()->create([
        'mandant_party_id' => $this->mandant->id, 'role' => 'holder', 'organization_name' => 'X', 'email' => 'unique@exemple.fr',
        'token_hash' => hash('sha256', 'autre'), 'code_hash' => hash('sha256', 'code'), 'status' => 'pending', 'expires_at' => now()->addDay(),
        'invited_by_user_id' => $this->titulaire->id, 'identity_attested_at' => now(),
    ])))->toThrow(UniqueConstraintViolationException::class);
    expect($existante->status->value)->toBe('pending')->and(User::query()->count())->toBeGreaterThan(0);
});
