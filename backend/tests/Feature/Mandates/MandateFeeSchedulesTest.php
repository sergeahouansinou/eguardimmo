<?php

declare(strict_types=1);

use App\Modules\Mandates\PublicApi\MandateDirectory;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->premier = M::actif($this->org, M::lot($this->org), M::partie($this->org));
    $this->second = M::actif($this->org, M::lot($this->org), M::partie($this->org));
});

it('lit les barèmes d\'un seul mandat quand on le demande, tous les mandats sinon', function (): void {
    $ids = fn (?string $mandat): array => M::dans($this->org, fn (): array => array_map(
        fn ($m): string => $m->mandateId,
        app(MandateDirectory::class)->feeSchedules('9999-12-31', $mandat),
    ));

    expect($ids(null))->toEqualCanonicalizing([$this->premier->id, $this->second->id])
        ->and($ids($this->second->id))->toBe([$this->second->id])
        ->and($ids((string) fake()->uuid()))->toBe([]);
});

it('ne charge que les lignes du mandat demandé', function (): void {
    $requetes = M::dans($this->org, function (): array {
        DB::enableQueryLog();
        app(MandateDirectory::class)->feeSchedules('9999-12-31', $this->second->id);
        $journal = DB::getQueryLog();
        DB::disableQueryLog();

        return array_column($journal, 'bindings');
    });

    expect(json_encode($requetes))->toContain($this->second->id)->not->toContain($this->premier->id);
});

it('ne sort jamais le mandat d\'une autre organisation', function (): void {
    $etrangere = M::organisation();
    $leur = M::actif($etrangere, M::lot($etrangere), M::partie($etrangere));

    expect(M::dans($this->org, fn (): array => app(MandateDirectory::class)->feeSchedules('9999-12-31', $leur->id)))->toBe([]);
});
