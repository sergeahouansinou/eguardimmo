<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Side;
use App\Shared\Database\Checks;

it('dérive la liste admise d\'une enum, avec ou sans valeur nulle', function (): void {
    expect(Checks::enum('side', Side::class))->toBe("side IN ('debit', 'credit')")
        ->and(Checks::enum('item_type', ItemType::class, nullable: true))->toStartWith('(item_type IS NULL OR item_type IN (')
        ->and(Checks::enum('item_type', ItemType::class, nullable: true))->toContain("'".ItemType::cases()[0]->value."'");
});

it('compare un code en majuscules en respectant la casse', function (): void {
    expect(Checks::uppercase('currency', 3))->toBe("REGEXP_LIKE(currency, '^[A-Z]{3}$', 'c')");
});

it('compose l\'instruction ALTER TABLE nommée {table}_{nom}_check', function (): void {
    expect(Checks::statement('certificates', 'period', 'expires_on IS NULL OR expires_on >= issued_on'))
        ->toBe('ALTER TABLE certificates ADD CONSTRAINT certificates_period_check CHECK (expires_on IS NULL OR expires_on >= issued_on)');
});
