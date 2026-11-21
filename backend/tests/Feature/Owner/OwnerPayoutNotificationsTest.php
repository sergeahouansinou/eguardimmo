<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Mail\NotificationMail;
use App\Modules\Notifications\Models\Notification;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerPayoutContext as P;

beforeEach(function (): void {
    ['org' => $this->org, 'mandant' => $this->mandant, 'awa' => $this->awa] = P::scene($this);
    Mail::fake();
    config(['notifications.urls.owner' => 'https://proprietaire.eguardimmo.test']);
    $this->acces = P::acces($this->awa);
    $this->agent = L::titulaire($this->org);
});

it('alerte le mandant à la demande, à la validation et à la contestation, par le centre et par e-mail', function (): void {
    $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
    expect(N::types($this->awa))->toBe(['owner.account_change_requested']);

    P::confirmer($this, $this->awa, $id)->assertOk();
    P::trancher($this, $this->org, $id, 'approve', P::approbation($id))->assertOk();
    O::comme($this, $this->awa)->postJson('/api/v1/owner/payout-account/contest', ['access_id' => $this->acces], O::ORIGINE)->assertOk();

    expect(N::types($this->awa))->toBe(['owner.account_change_requested', 'owner.account_change_approved', 'owner.account_change_contested']);

    foreach (Notification::query()->where('user_id', $this->awa->id)->get() as $n) {
        expect($n->audience->value)->toBe('owner')->and($n->in_app)->toBeTrue()->and($n->email)->toBeTrue()->and($n->link)->toBe('/compte-de-paiement')
            ->and($n->title.' '.$n->body)->not->toContain('FR76')->not->toContain('0189')->not->toContain('4321')->not->toContain($this->mandant->display_name);
    }

    expect(Mail::sent(NotificationMail::class, fn (NotificationMail $m): bool => $m->hasTo($this->awa->email))->count())->toBe(3)
        ->and(Mail::sent(NotificationMail::class, fn (NotificationMail $m): bool => $m->lien === 'https://proprietaire.eguardimmo.test/compte-de-paiement')->count())->toBe(3);
});

it('l\'équipe est prévenue quand la demande est confirmée par le code, et de la contestation, jamais avant', function (): void {
    $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
    expect(N::nombre($this->agent, NotificationType::OwnerFundsAccountChangeRequested))->toBe(0);

    P::confirmer($this, $this->awa, $id)->assertOk();
    expect(N::nombre($this->agent, NotificationType::OwnerFundsAccountChangeRequested))->toBe(1);

    O::comme($this, $this->awa)->postJson('/api/v1/owner/payout-account/contest', ['access_id' => $this->acces], O::ORIGINE)->assertOk();
    O::comme($this, $this->awa)->postJson('/api/v1/owner/payout-account/contest', ['access_id' => $this->acces], O::ORIGINE)->assertOk();

    $n = N::premiere($this->agent, NotificationType::OwnerFundsAccountChangeContested);
    expect(N::nombre($this->agent, NotificationType::OwnerFundsAccountChangeContested))->toBe(1)->and($n->audience->value)->toBe('staff')
        ->and($n->title.' '.$n->body)->not->toContain('FR76')->not->toContain($this->mandant->display_name)
        ->and(N::nombre($this->awa, NotificationType::OwnerAccountChangeContested))->toBe(1);
});

it('un compte non rattaché au mandant ne reçoit rien', function (): void {
    $etranger = User::factory()->create(['email' => 'etranger@exemple.fr']);

    P::demander($this, $this->awa, $this->acces)->assertCreated();

    expect(N::nombre($etranger))->toBe(0);
});
