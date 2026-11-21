<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Rent\Data\InstallmentNoticeData;
use App\Modules\Rent\Models\RentNotice;

final readonly class InstallmentNotices
{
    /**
     * @param  list<string>  $installmentIds
     * @return array<string, InstallmentNoticeData> par échéance ; une échéance sans avis émis est absente
     */
    public function of(array $installmentIds): array
    {
        $avis = [];

        foreach (array_chunk(array_values(array_unique($installmentIds)), 500) as $lot) {
            foreach (RentNotice::query()->whereIn('installment_id', $lot)->get() as $notice) {
                $avis[$notice->installment_id] = new InstallmentNoticeData(
                    $notice->installment_id,
                    $notice->number,
                    $notice->stored_file_id,
                    $notice->fingerprint,
                    $notice->issued_on->toDateString(),
                );
            }
        }

        return $avis;
    }
}
