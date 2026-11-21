<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\OwnerInvitationNotification;
use App\Modules\Parties\Events\OwnerAccessRevoked;
use App\Modules\Parties\Models\OwnerAccess;
use App\Modules\Parties\Notifications\OwnerAccessRevokedNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
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
    $this->p = O::proprietaire($this->org);
    $this->revoquerParAgence = fn () => O::comme($this, $this->titulaire)->deleteJson(O::urlAcces($this->org, $this->p['party'], '/'.$this->p['access']->id));
});

it('publie OwnerAccessRevoked une seule fois par révocation, avec la cause, et rien sur un refus', function (): void {
    Event::fake([OwnerAccessRevoked::class]);

    ($this->revoquerParAgence)()->assertNoContent();
    ($this->revoquerParAgence)()->assertNotFound();

    Event::assertDispatchedTimes(OwnerAccessRevoked::class, 1);
    Event::assertDispatched(OwnerAccessRevoked::class, fn (OwnerAccessRevoked $e): bool => $e->accessId === $this->p['access']->id && $e->organizationId === $this->org->id
        && $e->userId === $this->p['user']->id && $e->mandantPartyId === $this->p['party']->id && $e->by === OwnerRevoker::Organization);
});

it('prévient par e-mail le propriétaire révoqué par l\'agence, sans nom de mandant ni lien', function (): void {
    ($this->revoquerParAgence)()->assertNoContent();

    Notification::assertSentTo($this->p['user'], OwnerAccessRevokedNotification::class, function (OwnerAccessRevokedNotification $n): bool {
        $html = (string) $n->toMail(new stdClass)->render();

        return str_contains($html, 'Agence du Port') && ! str_contains($html, $this->p['party']->display_name) && ! str_contains($html, 'class="button');
    });
});

it('neutralise le nom d\'organisation dans l\'e-mail de révocation', function (): void {
    $html = (string) (new OwnerAccessRevokedNotification('[Rouvrir ici](https://hameconnage.example/x) <b>URGENT</b>'))->toMail(new stdClass)->render();

    expect($html)->not->toContain('href="https://hameconnage.example')->not->toContain('<b>URGENT')->toContain('URGENT');
});

it('prévient aussi le propriétaire quand l\'anonymisation de sa fiche révoque son accès', function (): void {
    O::comme($this, $this->titulaire)->postJson("/api/v1/org/{$this->org->id}/parties/{$this->p['party']->id}/anonymization")->assertSuccessful();

    Notification::assertSentTo($this->p['user'], OwnerAccessRevokedNotification::class);
});

it('ne prévient pas le compte qui révoque lui-même, ni un compte supprimé', function (): void {
    O::comme($this, $this->p['user'])->deleteJson('/api/v1/owner/links/'.$this->p['access']->id)->assertNoContent();
    Notification::assertNothingSentTo($this->p['user']);

    $autre = O::proprietaire($this->org, 'bob@exemple.fr');
    $autre['user']->delete();
    event(new AccountDeleted($autre['user']->id));

    Notification::assertNotSentTo($autre['user'], OwnerAccessRevokedNotification::class);
    expect(L::dans($this->org, fn (): int => OwnerAccess::query()->where('status', 'active')->count()))->toBe(0);
});

it('ne prévient personne quand la révocation vise une invitation en attente', function (): void {
    $mandant = O::mandant($this->org, 'carl@exemple.fr');
    O::preuve($this);
    $reponse = O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $mandant), ['role' => 'holder', 'identity_verified' => true])->assertCreated();
    Notification::assertSentOnDemand(OwnerInvitationNotification::class);

    O::comme($this, $this->titulaire)->deleteJson(O::urlAcces($this->org, $mandant, '/'.$reponse->json('data.invitation.id')))->assertNoContent();

    Notification::assertNotSentTo($this->p['user'], OwnerAccessRevokedNotification::class);
});

describe('réponses de l\'aperçu et de l\'acceptation', function (): void {
    beforeEach(function (): void {
        $this->compte = User::factory()->create(['email' => 'awa2@exemple.fr']);
        $this->mandant2 = O::mandant($this->org, 'awa2@exemple.fr');
        O::preuve($this);
        $this->emise = O::comme($this, $this->titulaire)->postJson(O::urlAcces($this->org, $this->mandant2), ['role' => 'holder', 'identity_verified' => true])->assertCreated();
        $this->jeton = '';
        Notification::assertSentOnDemand(OwnerInvitationNotification::class, function (OwnerInvitationNotification $n): bool {
            $this->jeton = basename($n->acceptUrl);

            return true;
        });
        $this->enTetes = fn ($reponse) => [$reponse->headers->get('Cache-Control'), $reponse->headers->get('Referrer-Policy')];
    });

    it('ne se met jamais en cache et ne divulgue pas le jeton par le référent, en succès comme en erreur', function (): void {
        $apercu = O::comme($this, $this->compte)->postJson('/api/v1/owner-invitations/preview', ['token' => $this->jeton])->assertOk();
        $inconnu = O::comme($this, $this->compte)->postJson('/api/v1/owner-invitations/preview', ['token' => str_repeat('x', 48)])->assertNotFound();
        $faux = O::comme($this, $this->compte)->postJson('/api/v1/owner-invitations/acceptance', ['token' => $this->jeton, 'code' => '000000', 'consent' => true]);
        $accepte = O::comme($this, $this->compte)->postJson('/api/v1/owner-invitations/acceptance', ['token' => $this->jeton, 'code' => (string) $this->emise->json('data.pairing_code'), 'consent' => true])->assertCreated();

        foreach ([$apercu, $inconnu, $faux, $accepte] as $reponse) {
            [$cache, $referent] = ($this->enTetes)($reponse);
            expect($cache)->toContain('no-store')->toContain('private')->and($referent)->toBe('no-referrer');
        }
    });
});
