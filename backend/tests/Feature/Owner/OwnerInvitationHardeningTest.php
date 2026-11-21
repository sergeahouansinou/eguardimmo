<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication as Reauth;
use App\Modules\Identity\Models\OwnerInvitation;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\OwnerInvitationNotification;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Parties\Notifications\OwnerLinkAlertNotification;
use Carbon\CarbonImmutable;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Routing\Middleware\ThrottleRequests;
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
    $this->mandant = O::mandant($this->org);
    O::mandat($this->org, $this->mandant);
    O::navigateurAgence($this);
    $this->corps = ['role' => 'holder', 'identity_verified' => true];
    $this->inviter = fn (array $corps = [], ?User $par = null) => O::comme($this, $par ?? $this->titulaire)->postJson(O::urlAcces($this->org, $this->mandant), [...$this->corps, ...$corps]);
});

it('exige la 2FA confirmée puis une preuve 2FA de moins de 10 minutes pour émettre une invitation', function (): void {
    $gestionnaire = L::membre($this->org, MemberRole::Manager);
    $this->withSession([Reauth::CLE_2FA => now()->getTimestamp()]);
    ($this->inviter)([], $gestionnaire)->assertForbidden()->assertJsonPath('code', 'two_factor_required');

    $this->flushSession();
    ($this->inviter)()->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    $this->withSession([Reauth::CLE_MOT_DE_PASSE => now()->getTimestamp()]);
    ($this->inviter)()->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    $this->flushSession();
    $this->withSession([Reauth::CLE_2FA => now()->subMinutes(11)->getTimestamp()]);
    ($this->inviter)()->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    $this->flushSession();
    $this->withSession([Reauth::CLE_2FA => now()->subMinutes(9)->getTimestamp()]);
    ($this->inviter)()->assertCreated();
    expect(L::dans($this->org, fn (): int => OwnerInvitation::query()->count()))->toBe(1);
});

it('laisse lire l\'état et révoquer sans 2FA : seule l\'émission est durcie', function (): void {
    $this->withSession([Reauth::CLE_2FA => now()->getTimestamp()]);
    $emise = ($this->inviter)()->assertCreated();
    $this->flushSession();

    O::comme($this, $this->titulaire)->getJson(O::urlAcces($this->org, $this->mandant))->assertOk()->assertJsonCount(1, 'data.invitations');
    O::comme($this, $this->titulaire)->deleteJson(O::urlAcces($this->org, $this->mandant, '/'.$emise->json('data.invitation.id')))->assertNoContent();
});

describe('adresse invitée', function (): void {
    beforeEach(function (): void {
        $this->withSession([Reauth::CLE_2FA => now()->getTimestamp()]);
    });

    it('refuse l\'adresse de l\'invitant, d\'un membre actif, invité ou désactivé, sans distinguer la casse', function (): void {
        $gestionnaire = L::membre($this->org, MemberRole::Manager);
        foreach ([MemberStatus::Invited, MemberStatus::Disabled] as $i => $statut) {
            L::dans($this->org, fn () => OrganizationMember::query()->create([
                'email' => "equipe{$i}@exemple.fr", 'first_name' => 'Lea', 'last_name' => 'Roux', 'role' => MemberRole::Accountant, 'status' => $statut,
            ]));
        }

        foreach ([$this->titulaire->email, strtoupper($gestionnaire->email), 'equipe0@exemple.fr', 'EQUIPE1@exemple.fr'] as $adresse) {
            ($this->inviter)(['email' => $adresse])->assertUnprocessable()->assertJsonPath('code', 'owner_access_email_forbidden');
        }

        Notification::assertNothingSent();
        expect(L::dans($this->org, fn (): int => OwnerInvitation::query()->count()))->toBe(0);
    });

    it('refuse aussi l\'adresse d\'un membre quand elle vient de la fiche du mandant', function (): void {
        $gestionnaire = L::membre($this->org, MemberRole::Manager);
        $fiche = O::mandant($this->org, $gestionnaire->email);

        O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $fiche), $this->corps)->assertUnprocessable()->assertJsonPath('code', 'owner_access_email_forbidden');
        Notification::assertNothingSent();
    });

    it('accepte l\'adresse d\'un membre d\'une autre organisation ou d\'un compte quelconque', function (): void {
        $autre = T::organisation();
        $membreAilleurs = L::membre($autre, MemberRole::Manager);
        User::factory()->create(['email' => 'client@exemple.fr']);

        ($this->inviter)(['email' => $membreAilleurs->email])->assertCreated();
        ($this->inviter)(['email' => 'client@exemple.fr'])->assertCreated();
    });

    it('prévient l\'adresse principale de la fiche du mandant, sans le code, quand l\'invitation vise une autre adresse', function (): void {
        $reponse = ($this->inviter)(['email' => 'autre@exemple.fr'])->assertCreated();

        Notification::assertSentOnDemand(OwnerLinkAlertNotification::class, function (OwnerLinkAlertNotification $n, array $canaux, object $notifiable) use ($reponse): bool {
            $texte = json_encode($n->toMail(new stdClass)->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);

            return $notifiable->routes['mail'] === 'awa@exemple.fr' && $n->kind === 'invited'
                && ! str_contains($texte, (string) $reponse->json('data.pairing_code')) && ! str_contains($texte, 'autre@exemple.fr') && str_contains($texte, 'Agence du Port');
        });
        Notification::assertSentOnDemand(OwnerInvitationNotification::class, fn ($n, $canaux, $notifiable): bool => $notifiable->routes['mail'] === 'autre@exemple.fr');
    });

    it('ne double pas l\'alerte quand l\'invitation vise déjà l\'adresse principale', function (): void {
        ($this->inviter)()->assertCreated();

        Notification::assertNotSentTo(new AnonymousNotifiable, OwnerLinkAlertNotification::class);
        Notification::assertSentOnDemandTimes(OwnerInvitationNotification::class, 1);
        Notification::assertSentOnDemandTimes(OwnerLinkAlertNotification::class, 0);
    });

    it('prévient l\'adresse principale à chaque rattachement, même quand elle est celle du compte', function (): void {
        $compte = User::factory()->create(['email' => 'awa@exemple.fr']);
        $reponse = ($this->inviter)()->assertCreated();
        $jeton = '';
        Notification::assertSentOnDemand(OwnerInvitationNotification::class, function (OwnerInvitationNotification $n) use (&$jeton): bool {
            $jeton = basename($n->acceptUrl);

            return true;
        });

        O::comme($this, $compte)->withoutMiddleware(ThrottleRequests::class)
            ->postJson('/api/v1/owner-invitations/acceptance', ['token' => $jeton, 'code' => $reponse->json('data.pairing_code'), 'consent' => true])->assertCreated();

        Notification::assertSentOnDemand(OwnerLinkAlertNotification::class, fn (OwnerLinkAlertNotification $n, array $canaux, object $notifiable): bool => $notifiable->routes['mail'] === 'awa@exemple.fr' && $n->kind === 'linked');
    });
});
