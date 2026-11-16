<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->partie = L::partie($this->org);
    $this->garant = L::partie($this->org);
    $this->bail = R::bailSigne($this->org, ['note' => 'Locataire sous surveillance']);
    R::lier($this->org, $this->bail, $this->garant, [
        'role' => 'guarantor',
        'guarantees_party_id' => $this->partie->id,
        'guarantee_limit_amount' => Money\Money::EUR(900000),
        'guarantee_ends_on' => '2030-01-01',
    ]);
});

it('montre la note et la garantie au titulaire, à l\'administrateur et au gestionnaire', function (MemberRole $role): void {
    $compte = $role === MemberRole::Owner ? L::titulaire($this->org) : L::membre($this->org, $role);
    activerDeuxFacteurs($compte);

    $reponse = $this->actingAs($compte)->getJson("/api/v1/org/{$this->org->id}/leases/{$this->bail->id}")->assertOk();

    $caution = collect($reponse->json('data.parties'))->firstWhere('role', 'guarantor');

    expect($reponse->json('data.note'))->toBe('Locataire sous surveillance')
        ->and($caution['guarantee']['ends_on'])->toBe('2030-01-01')
        ->and($caution['guarantee']['limit']['amount'])->toBe(900000);
})->with([MemberRole::Owner, MemberRole::Admin, MemberRole::Manager]);

it('masque la note et la garantie au comptable, qui garde le reste du bail', function (): void {
    $compte = L::membre($this->org, MemberRole::Accountant);
    activerDeuxFacteurs($compte);

    $reponse = $this->actingAs($compte)->getJson("/api/v1/org/{$this->org->id}/leases/{$this->bail->id}")->assertOk();

    $caution = collect($reponse->json('data.parties'))->firstWhere('role', 'guarantor');

    expect($reponse->json('data.note'))->toBeNull()
        ->and($caution['guarantee'])->toBeNull()
        ->and($caution['guarantees_party_id'])->toBe($this->partie->id)
        ->and($reponse->json('data.reference'))->toBe($this->bail->reference);
});
