<?php

declare(strict_types=1);

namespace App\Modules\Operations\Actions;

use App\Modules\Operations\Enums\ApprovalStatus;
use App\Modules\Operations\Models\OperatorApproval;
use App\Modules\Operations\Support\ApprovalTransitions;
use Illuminate\Support\Facades\DB;

final readonly class ExpireApprovals
{
    private const LOT = 100;

    public function __construct(private ApprovalTransitions $transitions) {}

    public function handle(): int
    {
        $expirees = 0;

        OperatorApproval::query()
            ->where('status', ApprovalStatus::Pending)->where('expires_at', '<=', now())
            ->orderBy('id')->pluck('id')
            ->chunk(self::LOT)
            ->each(function ($identifiants) use (&$expirees): void {
                foreach ($identifiants as $id) {
                    DB::transaction(function () use ($id, &$expirees): void {
                        if ($this->transitions->expireIfDue($this->transitions->locked((string) $id))) {
                            $expirees++;
                        }
                    });
                }
            });

        return $expirees;
    }
}
