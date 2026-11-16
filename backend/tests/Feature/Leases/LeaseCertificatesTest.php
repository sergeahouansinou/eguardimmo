<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->autre = L::organisation();
    $this->url = "/api/v1/org/{$this->org->id}/documents/certificates";
    $this->corps = fn (string $bailId): array => [
        'subject_type' => 'lease',
        'subject_id' => $bailId,
        'certificate_type_term_id' => L::terme('certificate_type', 'gas')->id,
        'issued_on' => '2026-01-10',
    ];
});

it('accepte une pièce à échéance sur un bail de l\'organisation', function (): void {
    $bail = L::bail($this->org);
    $this->actingAs(L::titulaire($this->org));

    $this->postJson($this->url, ($this->corps)($bail->id))
        ->assertCreated()
        ->assertJsonPath('data.subject.type', 'lease')
        ->assertJsonPath('data.subject.id', $bail->id);

    expect(DB::table('certificates')->where('subject_type', 'lease')->where('subject_id', $bail->id)->where('organization_id', $this->org->id)->count())->toBe(1);
});

it('refuse une pièce sur le bail d\'une autre organisation', function (): void {
    $bailEtranger = L::bail($this->autre);
    $this->actingAs(L::titulaire($this->org));

    $this->postJson($this->url, ($this->corps)($bailEtranger->id))
        ->assertNotFound()
        ->assertJsonPath('code', 'subject_not_found');

    expect(DB::table('certificates')->count())->toBe(0);
});

it('refuse une pièce sur un bail inexistant', function (): void {
    $this->actingAs(L::titulaire($this->org));

    $this->postJson($this->url, ($this->corps)(fake()->uuid()))->assertNotFound()->assertJsonPath('code', 'subject_not_found');
});
