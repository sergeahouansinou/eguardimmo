<?php

declare(strict_types=1);

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->site = C::site($this->org);
    $this->lot = C::lot($this->org, $this->site);
});

/**
 * @param  array<string, mixed>  $attributs
 */
function propertiesInsererPart(object $test, array $attributs): void
{
    DB::table('unit_ownerships')->insert([
        'id' => (string) Str::uuid7(), 'organization_id' => $test->org->id, 'unit_id' => $test->lot->id, 'party_id' => (string) Str::uuid7(),
        'share_bp' => 5000, 'nature' => 'full', 'valid_from' => '2024-01-01', 'valid_to' => null,
        'created_at' => now(), 'updated_at' => now(), ...$attributs,
    ]);
}

it('signale des quotes-parts cohérentes', function (): void {
    propertiesInsererPart($this, ['share_bp' => 6000, 'valid_to' => '2025-01-01']);
    propertiesInsererPart($this, ['share_bp' => 6000, 'valid_from' => '2025-01-01']);
    propertiesInsererPart($this, ['share_bp' => 10000, 'nature' => 'bare']);

    $this->artisan('properties:verify-ownerships')->expectsOutput('Quotes-parts de propriété cohérentes.')->assertSuccessful();

    expect(DB::table('audit_logs')->where('action', 'properties.ownership.anomaly_detected')->count())->toBe(0);
});

it('détecte un dépassement écrit hors de l\'Action : code de sortie en échec, log critique et audit', function (): void {
    Log::spy();
    propertiesInsererPart($this, ['share_bp' => 7000]);
    propertiesInsererPart($this, ['share_bp' => 5000, 'valid_from' => '2024-06-01']);

    $this->artisan('properties:verify-ownerships')->assertFailed();

    Log::shouldHaveReceived('critical')->once()->withArgs(fn (string $message, array $contexte): bool => $contexte['kind'] === 'share_exceeded' && $contexte['unit_id'] === $this->lot->id);
    $ligne = DB::table('audit_logs')->where('action', 'properties.ownership.anomaly_detected')->first();

    expect($ligne)->not->toBeNull()
        ->and($ligne->organization_id)->toBe($this->org->id)
        ->and($ligne->subject_id)->toBe($this->lot->id)
        ->and($ligne->subject_type)->toBe('unit');
});

it('ne mélange pas les natures de droit ni les lots', function (): void {
    $autreLot = C::lot($this->org, $this->site, 'apartment', ['reference' => 'A-2']);
    propertiesInsererPart($this, ['share_bp' => 10000]);
    propertiesInsererPart($this, ['share_bp' => 10000, 'nature' => 'usufruct']);
    propertiesInsererPart($this, ['unit_id' => $autreLot->id, 'share_bp' => 10000]);

    $this->artisan('properties:verify-ownerships')->assertSuccessful();
});

it('détecte une quote-part hors bornes et une période inversée', function (): void {
    propertiesInsererPart($this, ['share_bp' => 0]);
    propertiesInsererPart($this, ['share_bp' => 100, 'valid_from' => '2024-05-01', 'valid_to' => '2024-05-01', 'nature' => 'bare']);

    $this->artisan('properties:verify-ownerships')->assertFailed();

    $genres = DB::table('audit_logs')->where('action', 'properties.ownership.anomaly_detected')->pluck('metadata')
        ->map(fn (string $json): string => json_decode($json, true)['kind'])->sort()->values()->all();

    expect($genres)->toBe(['invalid_period', 'invalid_share']);
});

it('parcourt toutes les organisations', function (): void {
    $autre = C::organisation();
    $lotAutre = C::lot($autre, C::site($autre));
    propertiesInsererPart($this, ['organization_id' => $autre->id, 'unit_id' => $lotAutre->id, 'share_bp' => 8000]);
    propertiesInsererPart($this, ['organization_id' => $autre->id, 'unit_id' => $lotAutre->id, 'share_bp' => 8000]);

    $this->artisan('properties:verify-ownerships')->assertFailed();

    expect(DB::table('audit_logs')->where('action', 'properties.ownership.anomaly_detected')->value('organization_id'))->toBe($autre->id);
});

it('est planifié chaque jour', function (): void {
    $evenements = collect(app(Schedule::class)->events())->filter(fn ($evenement): bool => str_contains((string) $evenement->command, 'properties:verify-ownerships'));

    expect($evenements)->toHaveCount(1)->and($evenements->first()->expression)->toBe('45 3 * * *');
});
