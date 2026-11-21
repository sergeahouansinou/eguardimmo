<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication as Reauth;
use App\Modules\Identity\Models\OwnerInvitation;
use App\Modules\Identity\Models\TenantInvitation;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\OwnerInvitationNotification;
use App\Modules\Identity\Notifications\TenantInvitationNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

const NOM_PIEGE = "[Cliquez ici pour confirmer](https://hameconnage.example/connexion) <b>URGENT</b> *gras* _penche_ ![pixel](https://hameconnage.example/p.png) <https://hameconnage.example/auto> `code`\r\nBcc: pirate@hameconnage.example";

function rendu(object $notification): string
{
    return (string) $notification->toMail(new stdClass)->render();
}

function vieillir(int $heures): void
{
    DB::table('owner_invitations')->update(['created_at' => now()->subHours($heures)]);
    DB::table('tenant_invitations')->update(['created_at' => now()->subHours($heures)]);
}

function assertNomNeutralise(string $html): void
{
    expect($html)
        ->not->toContain('href="https://hameconnage.example')
        ->not->toContain('src="https://hameconnage.example')
        ->not->toContain('<b>URGENT')
        ->not->toContain('<em>penche')
        ->not->toContain('<strong>gras')
        ->not->toContain('<code>code')
        ->toContain('URGENT');
}

beforeEach(function (): void {
    Notification::fake();
    L::semer();
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    $this->org = T::organisation();
    $this->titulaire = L::titulaire($this->org);
    O::navigateurAgence($this);
    $this->withSession([Reauth::CLE_2FA => now()->getTimestamp()]);
});

it('neutralise le Markdown, le HTML et les sauts de ligne du nom d\'organisation dans l\'invitation propriétaire', function (): void {
    $notification = new OwnerInvitationNotification(NOM_PIEGE, 'https://auth.exemple.test/invitation-proprietaire/'.str_repeat('a', 48), 7);

    assertNomNeutralise(rendu($notification));
    expect($notification->toMail(new stdClass)->subject)->not->toContain("\n")->not->toContain("\r");
});

it('neutralise le nom d\'organisation dans l\'invitation locataire', function (): void {
    $notification = new TenantInvitationNotification(NOM_PIEGE, 'https://auth.exemple.test/invitation-locataire/'.str_repeat('b', 48));

    assertNomNeutralise(rendu($notification));
    expect($notification->toMail(new stdClass)->subject)->not->toContain("\n")->not->toContain("\r");
});

it('garde le lien d\'acceptation et un nom ordinaire lisibles', function (): void {
    $html = rendu(new OwnerInvitationNotification('Agence du Port - Cotonou', 'https://auth.exemple.test/invitation-proprietaire/'.str_repeat('c', 48), 7));

    expect($html)->toContain('href="https://auth.exemple.test/invitation-proprietaire/'.str_repeat('c', 48).'"')->toContain('Agence du Port - Cotonou');
});

it('envoie un nom piégé neutralisé quand l\'agence invite un propriétaire ou un locataire', function (): void {
    $this->org->forceFill(['name' => NOM_PIEGE])->save();
    $mandant = O::mandant($this->org);
    O::mandat($this->org, $mandant);

    O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $mandant), ['role' => 'holder', 'identity_verified' => true])->assertCreated();
    Notification::assertSentOnDemand(OwnerInvitationNotification::class, function (OwnerInvitationNotification $n): bool {
        assertNomNeutralise(rendu($n));

        return true;
    });

    $partie = T::partie($this->org);
    T::emailPrincipal($this->org, $partie, 'koffi@exemple.fr');
    O::comme($this, $this->titulaire)->postJson("/api/v1/org/{$this->org->id}/parties/{$partie->id}/tenant-access")->assertCreated();
    Notification::assertSentOnDemand(TenantInvitationNotification::class, function (TenantInvitationNotification $n): bool {
        assertNomNeutralise(rendu($n));

        return true;
    });
});

it('plafonne par jour les invitations propriétaire d\'une organisation, remplacements compris', function (): void {
    config(['identity.owner_invitation_daily_max' => 3]);
    $mandant = O::mandant($this->org);
    $inviter = fn (string $email) => O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $mandant), ['role' => 'holder', 'identity_verified' => true, 'email' => $email]);

    $inviter('a1@exemple.fr')->assertCreated();
    $inviter('a2@exemple.fr')->assertCreated();
    $inviter('a1@exemple.fr')->assertCreated();
    $inviter('a3@exemple.fr')->assertStatus(429)->assertJsonPath('code', 'invitation_daily_limit_reached');
    expect(L::dans($this->org, fn (): int => OwnerInvitation::query()->count()))->toBe(3);

    $autre = T::organisation();
    $autreMandant = O::mandant($autre);
    O::comme($this, L::titulaire($autre))->postJson(O::urlAcces($autre, $autreMandant), ['role' => 'holder', 'identity_verified' => true, 'email' => 'x@exemple.fr'])->assertCreated();

    vieillir(25);
    $inviter('a3@exemple.fr')->assertCreated();
});

it('plafonne par jour les invitations locataire d\'une organisation', function (): void {
    config(['identity.tenant_invitation_daily_max' => 2]);
    $inviter = function (string $email) {
        $partie = T::partie($this->org);
        T::emailPrincipal($this->org, $partie, $email);

        return O::comme($this, $this->titulaire)->postJson("/api/v1/org/{$this->org->id}/parties/{$partie->id}/tenant-access");
    };

    $inviter('t1@exemple.fr')->assertCreated();
    $inviter('t2@exemple.fr')->assertCreated();
    $inviter('t3@exemple.fr')->assertStatus(429)->assertJsonPath('code', 'invitation_daily_limit_reached');
    expect(L::dans($this->org, fn (): int => TenantInvitation::query()->count()))->toBe(2);

    vieillir(25);
    $inviter('t4@exemple.fr')->assertCreated();
});

it('ne compte pas les comptes ni les anciennes invitations d\'une autre organisation', function (): void {
    config(['identity.owner_invitation_daily_max' => 1]);
    $mandant = O::mandant($this->org);
    User::factory()->create();

    O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $mandant), ['role' => 'holder', 'identity_verified' => true, 'email' => 'seul@exemple.fr'])->assertCreated();
    O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $mandant), ['role' => 'holder', 'identity_verified' => true, 'email' => 'deux@exemple.fr'])->assertStatus(429);
});
