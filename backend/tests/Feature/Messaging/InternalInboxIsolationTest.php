<?php

declare(strict_types=1);

use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Models\OrganizationMember;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\MessagingContext as M;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    L::semer();
    config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:00:00'));
    $this->org = T::organisation();
    $this->base = "/api/v1/org/{$this->org->id}/conversations";
    $this->gestionnaire = L::membre($this->org, MemberRole::Manager);
    $this->collegue = L::membre($this->org, MemberRole::Manager);
    $this->locataire = T::locataire($this->org);
    $this->mandant = O::proprietaire($this->org);
});

function retrograderEnComptable(mixed $test): void
{
    L::dans($test->org, fn () => OrganizationMember::query()->where('user_id', $test->gestionnaire->id)->update(['role' => MemberRole::Accountant]));
}

it('ne sert jamais un fil externe dans la boîte interne d\'un ancien gestionnaire devenu comptable', function (): void {
    $fil = M::filLocataire($this->org, $this->gestionnaire, $this->locataire, 'Dépôt de garantie litigieux');
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:05:00'));
    M::repondre($this->org, $this->locataire['user'], $fil, 'Je conteste le décompte.', MessageSide::Tenant);
    $filMandant = M::filMandant($this->org, $this->gestionnaire, $this->mandant['party']->id, 'Mandat à renégocier');
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:06:00'));
    M::repondre($this->org, $this->mandant['user'], $filMandant, 'Rappelez-moi.', MessageSide::Owner);

    retrograderEnComptable($this);

    foreach (['', '?tab=unread', '?tab=archived', '?tab=sent', '?tab=awaiting', '?search=Dépôt', '?search=garantie'] as $suite) {
        O::comme($this, $this->gestionnaire)->getJson($this->base.$suite)->assertOk()->assertJsonCount(0, 'data');
    }

    $liste = O::comme($this, $this->gestionnaire)->getJson($this->base)->assertOk();
    expect(array_sum($liste->json('counts')))->toBe(0);
    O::comme($this, $this->gestionnaire)->getJson("{$this->base}/stats")->assertOk()->assertJsonPath('data.unread', 0)->assertJsonPath('data.stale', 0);
    O::comme($this, $this->gestionnaire)->getJson("{$this->base}/unread")->assertOk()->assertJsonPath('data.internal', 0)->assertJsonPath('data.tenant', 0)->assertJsonPath('data.owner', 0);
    O::comme($this, $this->gestionnaire)->getJson("{$this->base}/{$fil->id}")->assertForbidden();
});

it('garde les fils internes d\'un membre quand il participe aussi à des fils externes', function (): void {
    M::filLocataire($this->org, $this->gestionnaire, $this->locataire, 'Quittance');
    $interne = O::comme($this, $this->collegue)->postJson($this->base, ['recipient_id' => $this->gestionnaire->id, 'subject' => 'Point équipe', 'body' => 'On se voit ?'])->assertCreated()->json('data.id');

    $liste = O::comme($this, $this->gestionnaire)->getJson($this->base)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $interne);
    expect($liste->json('counts.all'))->toBe(1);
    O::comme($this, $this->gestionnaire)->getJson("{$this->base}/stats")->assertOk()->assertJsonPath('data.unread', 1);
    O::comme($this, $this->gestionnaire)->getJson("{$this->base}/unread")->assertOk()->assertJsonPath('data.internal', 1);
});
