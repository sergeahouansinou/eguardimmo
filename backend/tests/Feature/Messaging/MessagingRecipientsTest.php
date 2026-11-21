<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\MessagingContext as M;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    Mail::fake();
    config(['notifications.push.driver' => 'fake']);
    L::semer();
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->org = T::organisation();
    $this->equipe = L::membre($this->org, MemberRole::Manager);
});

function notifie(string $type): array
{
    return DB::table('notifications')->where('type', $type)->pluck('user_id')->all();
}

it('prévient un locataire dont le bail est encore lisible, jamais un ancien locataire hors fenêtre', function (): void {
    $fini = T::locataire($this->org, ['status' => LeaseStatus::Terminated, 'starts_on' => '2024-01-01', 'ends_on' => '2025-11-17'], ['valid_from' => '2024-01-01']);
    $fil = M::filLocataire($this->org, $this->equipe, $fini);
    M::lire($this->org, $fini['user'], $fil, MessageSide::Tenant);
    $avant = count(notifie('tenant.message_received'));
    expect($avant)->toBe(1);

    $this->travelTo(CarbonImmutable::parse('2026-11-17 00:00:01'));
    M::repondre($this->org, $this->equipe, $fil, 'Votre dépôt de garantie est restitué.');

    expect(notifie('tenant.message_received'))->toHaveCount($avant);

    $this->travelTo(CarbonImmutable::parse('2026-11-16 23:00:00'));
    M::lire($this->org, $fini['user'], $fil, MessageSide::Tenant);
    M::repondre($this->org, $this->equipe, $fil, 'Encore dans la fenêtre.');

    expect(notifie('tenant.message_received'))->toHaveCount($avant + 1);
});

it('prévient un mandant dont la fenêtre est ouverte, jamais après la fin de la grâce', function (): void {
    $fin = O::proprietaire($this->org, 'fin@exemple.fr', OwnerAccessRole::Holder, MandateStatus::Terminated);
    $fin['mandate']->forceFill(['starts_on' => '2025-01-01', 'ends_on' => '2026-01-01'])->saveQuietly();
    $fil = M::filMandant($this->org, $this->equipe, $fin['party']->id);
    M::lire($this->org, $fin['user'], $fil, MessageSide::Owner);
    $avant = count(notifie('owner.message_received'));
    expect($avant)->toBe(1);

    $this->travelTo(CarbonImmutable::parse('2027-01-01 00:00:01'));
    M::repondre($this->org, $this->equipe, $fil, 'Votre relevé final.');

    expect(notifie('owner.message_received'))->toHaveCount($avant);
});
